//! Lazy refresh of native-MCP OAuth access tokens, run by the runner
//! just before it reads tokens for a run.
//!
//! The web layer mints tokens at authorize time (and on a manual
//! "Reconnect") but has no refresh path. Native-MCP access tokens are
//! short-lived (Attio's are hours), so without this an expired token
//! reaches the agent and the run dies with a 401 — after which the
//! existing stale-marking path flips the connection to 'stale' and the
//! user has to reconnect by hand.
//!
//! Providers that support the `offline_access` scope (Attio does, and
//! TAS requests it) hand back a `refresh_token` at authorize time,
//! which we stored in the encrypted credentials blob. Here we spend it
//! for a fresh access token via `grant_type=refresh_token` and persist
//! the result in the exact shape the web `saveNativeConnection`
//! writes: the encrypted credentials JSON plus the denormalized
//! `token_expires_at` column.
//!
//! Everything is best-effort and per-connection: a failed refresh is
//! logged and the run proceeds with whatever token is on hand, so a
//! provider outage can't take down runs that don't touch that
//! connection. A refresh the provider actively *rejects* (4xx → dead
//! refresh token) proactively flips the row to 'stale' so the UI
//! prompts Reconnect rather than waiting for a run to 401.

use anyhow::{anyhow, Context};
use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use sqlx::PgPool;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use crate::crypto::MasterKey;

/// Refresh tokens already expired or within this window of expiring,
/// so a token can't die mid-run between the sweep and the agent's
/// first tool call.
const REFRESH_SKEW_SECS: i64 = 120;

// Native-MCP providers TAS can refresh tokens for, as
// (mcp_server_url origin → allowed OAuth authorization-server origins).
// MUST mirror the web catalog in web/src/lib/mcp-providers.ts
// (mcpServerUrl + oauthAuthorizationServerOrigins) — keep both in sync
// when adding a provider, or refreshes for the new provider abort and its
// short-lived tokens 401 mid-run.
const ATTIO_MCP_ORIGIN: &str = "https://mcp.attio.com";
const ATTIO_OAUTH_ORIGINS: &[&str] = &["https://app.attio.com"];
const PYLON_MCP_ORIGIN: &str = "https://mcp.usepylon.com";
const PYLON_OAUTH_ORIGINS: &[&str] = &["https://o.auth.usepylon.com"];
// HubSpot advertises its auth server as the MCP origin itself and uses a
// CONFIDENTIAL client (no DCR) — the refresh below presents client_id +
// client_secret from workspace_native_oauth_client when the connection's
// metadata says auth_mode=manual.
const HUBSPOT_MCP_ORIGIN: &str = "https://mcp.hubspot.com";
const HUBSPOT_OAUTH_ORIGINS: &[&str] = &["https://mcp.hubspot.com"];
// Fathom's auth server is api.fathom.ai but its authorize endpoint lives on
// fathom.video — both origins are allowed (matches the web catalog).
const FATHOM_MCP_ORIGIN: &str = "https://api.fathom.ai";
const FATHOM_OAUTH_ORIGINS: &[&str] = &["https://api.fathom.ai", "https://fathom.video"];
// Dialed advertises its auth server as the apex (also the MCP origin).
const DIALED_MCP_ORIGIN: &str = "https://dialed.day";
const DIALED_OAUTH_ORIGINS: &[&str] = &["https://dialed.day"];
// Linear advertises its auth server as the MCP origin itself (DCR, public
// client, read+write scopes). Docs: https://linear.app/docs/mcp
const LINEAR_MCP_ORIGIN: &str = "https://mcp.linear.app";
const LINEAR_OAUTH_ORIGINS: &[&str] = &["https://mcp.linear.app"];
// Amplemarket advertises its auth server as https://app.amplemarket.com (DCR,
// public client, PKCE S256, scopes mcp:read/mcp:write) — TAS-managed, like Attio.
const AMPLEMARKET_MCP_ORIGIN: &str = "https://mcp.amplemarket.com";
const AMPLEMARKET_OAUTH_ORIGINS: &[&str] = &["https://app.amplemarket.com"];
// Clay advertises api.clay.com as its auth server (DCR, public client, PKCE S256,
// scope "mcp"), but its authorize endpoint lives on app.clay.com while
// token/registration sit on api.clay.com — both origins allowed (like Fathom).
const CLAY_MCP_ORIGIN: &str = "https://api.clay.com";
const CLAY_OAUTH_ORIGINS: &[&str] = &["https://api.clay.com", "https://app.clay.com"];
// Avoma advertises its auth server as https://prod-api.avoma.com (DCR, PKCE S256,
// refresh_token grant; external_api:* scopes via the catalog scopeOverride).
const AVOMA_MCP_ORIGIN: &str = "https://mcp.avoma.com";
const AVOMA_OAUTH_ORIGINS: &[&str] = &["https://prod-api.avoma.com"];
// Gmail (Google Workspace MCP) is a confidential/manual client on standard
// Google OAuth: the auth server is accounts.google.com but its TOKEN endpoint
// lives on a separate origin (oauth2.googleapis.com) — both must be trusted so
// the refresh-before-use sweep can renew the access token.
const GMAIL_MCP_ORIGIN: &str = "https://gmailmcp.googleapis.com";
const GMAIL_OAUTH_ORIGINS: &[&str] = &[
    "https://accounts.google.com",
    "https://oauth2.googleapis.com",
];
// Batch sourced from anthropics/knowledge-work-plugins .mcp.json; each confirmed
// DCR (registration_endpoint at the MCP origin's auth-server metadata). Must
// stay in lockstep with the web catalog (mcp-providers.ts).
const NOTION_MCP_ORIGIN: &str = "https://mcp.notion.com";
const NOTION_OAUTH_ORIGINS: &[&str] = &["https://mcp.notion.com"];
const INTERCOM_MCP_ORIGIN: &str = "https://mcp.intercom.com";
const INTERCOM_OAUTH_ORIGINS: &[&str] = &["https://mcp.intercom.com"];
const ATLASSIAN_MCP_ORIGIN: &str = "https://mcp.atlassian.com";
const ATLASSIAN_OAUTH_ORIGINS: &[&str] =
    &["https://mcp.atlassian.com", "https://cf.mcp.atlassian.com"];
const ASANA_MCP_ORIGIN: &str = "https://mcp.asana.com";
const ASANA_OAUTH_ORIGINS: &[&str] = &["https://mcp.asana.com"];
const MONDAY_MCP_ORIGIN: &str = "https://mcp.monday.com";
const MONDAY_OAUTH_ORIGINS: &[&str] = &["https://mcp.monday.com"];
const GURU_MCP_ORIGIN: &str = "https://mcp.api.getguru.com";
const GURU_OAUTH_ORIGINS: &[&str] = &["https://mcp.api.getguru.com"];
const FIREFLIES_MCP_ORIGIN: &str = "https://api.fireflies.ai";
const FIREFLIES_OAUTH_ORIGINS: &[&str] = &["https://api.fireflies.ai"];
const AMPLITUDE_MCP_ORIGIN: &str = "https://mcp.amplitude.com";
const AMPLITUDE_OAUTH_ORIGINS: &[&str] = &["https://mcp.amplitude.com"];
const APOLLO_MCP_ORIGIN: &str = "https://mcp.apollo.io";
const APOLLO_OAUTH_ORIGINS: &[&str] = &["https://mcp.apollo.io"];

const NATIVE_MCP_OAUTH_ALLOWLIST: &[(&str, &[&str])] = &[
    (ATTIO_MCP_ORIGIN, ATTIO_OAUTH_ORIGINS),
    (PYLON_MCP_ORIGIN, PYLON_OAUTH_ORIGINS),
    (HUBSPOT_MCP_ORIGIN, HUBSPOT_OAUTH_ORIGINS),
    (FATHOM_MCP_ORIGIN, FATHOM_OAUTH_ORIGINS),
    (DIALED_MCP_ORIGIN, DIALED_OAUTH_ORIGINS),
    (LINEAR_MCP_ORIGIN, LINEAR_OAUTH_ORIGINS),
    (AMPLEMARKET_MCP_ORIGIN, AMPLEMARKET_OAUTH_ORIGINS),
    (CLAY_MCP_ORIGIN, CLAY_OAUTH_ORIGINS),
    (AVOMA_MCP_ORIGIN, AVOMA_OAUTH_ORIGINS),
    (GMAIL_MCP_ORIGIN, GMAIL_OAUTH_ORIGINS),
    (NOTION_MCP_ORIGIN, NOTION_OAUTH_ORIGINS),
    (INTERCOM_MCP_ORIGIN, INTERCOM_OAUTH_ORIGINS),
    (ATLASSIAN_MCP_ORIGIN, ATLASSIAN_OAUTH_ORIGINS),
    (ASANA_MCP_ORIGIN, ASANA_OAUTH_ORIGINS),
    (MONDAY_MCP_ORIGIN, MONDAY_OAUTH_ORIGINS),
    (GURU_MCP_ORIGIN, GURU_OAUTH_ORIGINS),
    (FIREFLIES_MCP_ORIGIN, FIREFLIES_OAUTH_ORIGINS),
    (AMPLITUDE_MCP_ORIGIN, AMPLITUDE_OAUTH_ORIGINS),
    (APOLLO_MCP_ORIGIN, APOLLO_OAUTH_ORIGINS),
];

#[derive(Deserialize)]
struct ProtectedResourceMeta {
    authorization_servers: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct AuthServerMeta {
    token_endpoint: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
    scope: Option<String>,
    token_type: Option<String>,
}

/// Refresh every active oauth2 native connection for this
/// (workspace, user) whose token is at/near expiry and that has a
/// stored refresh_token. Best-effort: never returns an error for a
/// single connection's failure — those are logged and swallowed so
/// the run can continue.
pub async fn refresh_expiring_native_connections(
    pool: &PgPool,
    key: &MasterKey,
    http: &reqwest::Client,
    workspace_id: uuid::Uuid,
    user_id: &str,
) -> anyhow::Result<()> {
    let threshold = Utc::now() + Duration::seconds(REFRESH_SKEW_SECS);
    let rows: Vec<(
        uuid::Uuid,
        String,
        String,
        Option<String>,
        Vec<u8>,
        serde_json::Value,
    )> = sqlx::query_as(
        "SELECT id, type, name, mcp_server_url, credentials, metadata \
           FROM workspace_connection \
          WHERE workspace_id = $1 AND user_id = $2 \
            AND status = 'active' AND auth_type = 'oauth2' \
            AND token_expires_at IS NOT NULL \
            AND token_expires_at < $3",
    )
    .bind(workspace_id)
    .bind(user_id)
    .bind(threshold)
    .fetch_all(pool)
    .await
    .context("failed to list native connections for refresh")?;

    for (id, provider, name, mcp_url, ciphertext, metadata) in rows {
        match refresh_one(
            pool,
            key,
            http,
            workspace_id,
            user_id,
            id,
            &provider,
            &name,
            &mcp_url,
            &ciphertext,
            &metadata,
        )
        .await
        {
            Ok(()) => {
                tracing::info!(%provider, %name, "refreshed native MCP token before run")
            }
            Err(e) => {
                tracing::warn!(?e, %provider, %name, "native MCP token refresh failed; leaving token as-is")
            }
        }
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)] // one row's worth of refresh inputs
async fn refresh_one(
    pool: &PgPool,
    key: &MasterKey,
    http: &reqwest::Client,
    workspace_id: uuid::Uuid,
    user_id: &str,
    id: uuid::Uuid,
    provider: &str,
    name: &str,
    mcp_url: &Option<String>,
    ciphertext: &[u8],
    metadata: &serde_json::Value,
) -> anyhow::Result<()> {
    let mcp_url = mcp_url
        .as_deref()
        .filter(|u| !u.is_empty())
        .ok_or_else(|| anyhow!("connection has no mcp_server_url"))?;

    let conn_aad = crate::crypto::aad::native_connection(workspace_id, user_id, provider, name);
    let plaintext = key
        .decrypt_aad(ciphertext, conn_aad.as_bytes())
        .context("decrypt credentials")?;
    let creds: serde_json::Value =
        serde_json::from_str(&plaintext).context("credentials not JSON")?;
    let refresh_token = creds
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow!("no refresh_token stored — reconnect required"))?;
    // The client identity the refresh exchange presents:
    //  - manual (HubSpot): BYO client_id + client_secret from
    //    workspace_native_oauth_client → client_secret_post.
    //  - dcr_confidential (Avoma): client_id + client_secret stored IN the
    //    credentials blob (no per-workspace app) → HTTP Basic.
    //  - dcr (public): a `dcr_client_id`, no secret.
    let auth_mode = metadata.get("auth_mode").and_then(|v| v.as_str());
    let (client_id, client_secret, use_basic): (String, Option<String>, bool) = match auth_mode {
        Some("manual") => {
            // Which BYO app instance this connection authorized against. Older
            // rows (pre multi-instance) have no `instance` → fall back to
            // "default", which is where their single app was migrated.
            let instance = metadata
                .get("instance")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .unwrap_or("default");
            let (cid, secret) =
                native_oauth_client_secret(pool, key, workspace_id, provider, instance).await?;
            (cid, Some(secret), false)
        }
        Some("dcr_confidential") => {
            let cid = creds
                .get("client_id")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .ok_or_else(|| anyhow!("dcr_confidential connection has no client_id stored"))?
                .to_string();
            let secret = creds
                .get("client_secret")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .ok_or_else(|| anyhow!("dcr_confidential connection has no client_secret stored"))?
                .to_string();
            (cid, Some(secret), true)
        }
        _ => {
            let cid = metadata
                .get("dcr_client_id")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .ok_or_else(|| anyhow!("no dcr_client_id in connection metadata"))?
                .to_string();
            (cid, None, false)
        }
    };

    let instance_based = metadata
        .get("instance_based")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let token_endpoint = discover_token_endpoint(http, mcp_url, instance_based).await?;

    let mut form: Vec<(&str, &str)> = vec![
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("client_id", client_id.as_str()),
    ];
    let mut req = http
        .post(token_endpoint)
        .header("Accept", "application/json");
    // Confidential client auth: dcr_confidential uses HTTP Basic (Avoma's default);
    // manual uses client_secret_post (in the body). Public sends neither.
    if let Some(ref secret) = client_secret {
        if use_basic {
            req = req.basic_auth(client_id.as_str(), Some(secret.as_str()));
        } else {
            form.push(("client_secret", secret.as_str()));
        }
    }
    let res = req
        .form(&form)
        .send()
        .await
        .context("refresh request failed")?;

    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        // 4xx means the refresh token itself is dead (revoked or
        // expired). Proactively flip to 'stale' so the Connections
        // page prompts Reconnect instead of letting the run 401.
        // 5xx/transient: leave the row active and try again next run.
        if status.is_client_error() {
            let _ = sqlx::query(
                "UPDATE workspace_connection \
                    SET status = 'stale', updated_at = now() WHERE id = $1",
            )
            .bind(id)
            .execute(pool)
            .await;
        }
        return Err(anyhow!(
            "refresh rejected ({status}): {}",
            body.chars().take(200).collect::<String>()
        ));
    }

    let token: TokenResponse = res.json().await.context("refresh response not JSON")?;
    let access_token = token
        .access_token
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow!("refresh response had no access_token"))?;
    // Rotate the refresh token if the server issued a new one
    // (OAuth servers commonly do); otherwise the prior one stays
    // valid and we keep it.
    let new_refresh = token
        .refresh_token
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| refresh_token.to_string());
    let expires_at: Option<DateTime<Utc>> = token
        .expires_in
        .map(|secs| Utc::now() + Duration::seconds(secs));

    // Same JSON shape as the web `ConnectionCredentials` / what
    // saveNativeConnection persists, so a blob written here round-trips
    // through the web layer unchanged.
    let mut new_creds = serde_json::json!({
        "access_token": access_token,
        "refresh_token": new_refresh,
        "expires_at": expires_at.map(|t| t.to_rfc3339()),
        "scope": token.scope,
        "token_type": token.token_type,
    });
    // dcr_confidential stores its client_id/secret in the blob — this rewrite
    // would drop them, so carry them forward for the next refresh.
    if auth_mode == Some("dcr_confidential") {
        if let Some(ref secret) = client_secret {
            new_creds["client_id"] = serde_json::Value::String(client_id.clone());
            new_creds["client_secret"] = serde_json::Value::String(secret.clone());
        }
    }
    let blob = key
        .encrypt_aad(&new_creds.to_string(), conn_aad.as_bytes())
        .context("encrypt refreshed credentials")?;

    sqlx::query(
        "UPDATE workspace_connection \
            SET credentials = $1, token_expires_at = $2, \
                status = 'active', updated_at = now() \
          WHERE id = $3",
    )
    .bind(blob)
    .bind(expires_at)
    .bind(id)
    .execute(pool)
    .await
    .context("failed to persist refreshed credentials")?;

    Ok(())
}

/// Read + decrypt the bring-your-own OAuth client (client_id + client_secret)
/// an admin stored for a confidential native-MCP provider (HubSpot). Errors if
/// the app isn't configured (the connection can't be refreshed without it).
async fn native_oauth_client_secret(
    pool: &PgPool,
    key: &MasterKey,
    workspace_id: uuid::Uuid,
    provider: &str,
    instance: &str,
) -> anyhow::Result<(String, String)> {
    let row: Option<(String, Vec<u8>)> = sqlx::query_as(
        "SELECT client_id, client_secret_ciphertext FROM workspace_native_oauth_client \
           WHERE workspace_id = $1 AND provider = $2 AND instance = $3",
    )
    .bind(workspace_id)
    .bind(provider)
    .bind(instance)
    .fetch_optional(pool)
    .await
    .context("failed to read workspace_native_oauth_client")?;
    let (client_id, ciphertext) = row.ok_or_else(|| {
        anyhow!("no OAuth app \"{instance}\" configured for native provider {provider}")
    })?;
    let secret = key
        .decrypt_aad(
            &ciphertext,
            crate::crypto::aad::native_oauth_client(workspace_id, provider, instance).as_bytes(),
        )
        .context("decrypt client_secret")?;
    Ok((client_id, secret))
}

/// Resolve a provider's token endpoint from its MCP URL via the same
/// two-hop discovery the web authorize route uses: the resource
/// server's protected-resource metadata points at an authorization
/// server, whose metadata carries the token endpoint. We rediscover
/// each refresh rather than storing the endpoint, so it stays correct
/// without a migration or re-auth for already-connected rows.
async fn discover_token_endpoint(
    http: &reqwest::Client,
    mcp_url: &str,
    instance_based: bool,
) -> anyhow::Result<reqwest::Url> {
    let mcp_url = parse_trusted_https_url(mcp_url, "mcp_server_url")?;
    assert_public_endpoint_host(&mcp_url, "mcp_server_url").await?;
    let origin = mcp_url.origin().ascii_serialization();
    // Fixed providers: compile-time allowlist. Instance-based (self-hosted, e.g.
    // Metabase): same-origin — OAuth endpoints must live on the connection's own
    // origin (validated at Connect time; still SSRF-guarded above + below).
    let instance_origins = [origin.as_str()];
    let allowed_oauth_origins: &[&str] = if instance_based {
        &instance_origins
    } else {
        allowed_oauth_origins_for_mcp_origin(&origin).ok_or_else(|| {
            anyhow!("mcp_server_url origin is not in the native-MCP provider allowlist")
        })?
    };

    // RFC 9728: protected-resource metadata lives at the origin — but some
    // servers (Gmail) serve it only PATH-SUFFIXED with the resource path and
    // 404 at the bare origin. Try the origin first (all DCR providers), then the
    // suffixed form derived from the MCP URL's path.
    let mut pr_candidates = vec![format!("{origin}/.well-known/oauth-protected-resource")];
    let res_path = mcp_url.path().trim_end_matches('/');
    if !res_path.is_empty() {
        pr_candidates.push(format!(
            "{origin}/.well-known/oauth-protected-resource{res_path}"
        ));
    }
    let mut pr: Option<ProtectedResourceMeta> = None;
    let mut last_err: Option<anyhow::Error> = None;
    for cand in &pr_candidates {
        let url = match reqwest::Url::parse(cand) {
            Ok(u) => u,
            Err(e) => {
                last_err = Some(anyhow!(e).context("bad protected-resource metadata URL"));
                continue;
            }
        };
        match http
            .get(url)
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(resp) => match resp.error_for_status() {
                Ok(ok) => match ok.json::<ProtectedResourceMeta>().await {
                    Ok(meta) => {
                        pr = Some(meta);
                        break;
                    }
                    Err(e) => {
                        last_err = Some(anyhow!(e).context("protected-resource metadata not JSON"))
                    }
                },
                Err(e) => {
                    last_err = Some(anyhow!(e).context("protected-resource discovery error status"))
                }
            },
            Err(e) => last_err = Some(anyhow!(e).context("protected-resource discovery failed")),
        }
    }
    let pr = pr.ok_or_else(|| {
        last_err.unwrap_or_else(|| anyhow!("protected-resource discovery failed"))
    })?;

    let as_base_raw = pr
        .authorization_servers
        .and_then(|v| v.into_iter().next())
        .ok_or_else(|| anyhow!("no authorization_servers in protected-resource metadata"))?;
    let as_base = parse_trusted_oauth_url(
        &as_base_raw,
        allowed_oauth_origins,
        "authorization server URL",
    )?;
    assert_public_endpoint_host(&as_base, "authorization server URL").await?;

    let mut as_meta_url = as_base;
    as_meta_url.set_path("/.well-known/oauth-authorization-server");
    as_meta_url.set_query(None);
    as_meta_url.set_fragment(None);
    let asm: AuthServerMeta = http
        .get(as_meta_url)
        .header("Accept", "application/json")
        .send()
        .await
        .context("authorization-server discovery failed")?
        .error_for_status()
        .context("authorization-server discovery returned an error status")?
        .json()
        .await
        .context("authorization-server metadata not JSON")?;

    let token_endpoint = asm
        .token_endpoint
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow!("authorization-server metadata missing token_endpoint"))?;
    let token_endpoint =
        parse_trusted_oauth_url(&token_endpoint, allowed_oauth_origins, "token endpoint")?;
    assert_public_endpoint_host(&token_endpoint, "token endpoint").await?;
    Ok(token_endpoint)
}

fn allowed_oauth_origins_for_mcp_origin(origin: &str) -> Option<&'static [&'static str]> {
    NATIVE_MCP_OAUTH_ALLOWLIST
        .iter()
        .find(|(mcp_origin, _)| *mcp_origin == origin)
        .map(|(_, oauth_origins)| *oauth_origins)
}

fn parse_trusted_oauth_url(
    raw_url: &str,
    allowed_origins: &[&str],
    label: &str,
) -> anyhow::Result<reqwest::Url> {
    let url = parse_trusted_https_url(raw_url, label)?;
    let origin = url.origin().ascii_serialization();
    if !allowed_origins.iter().any(|allowed| *allowed == origin) {
        return Err(anyhow!("{label} is not on an allowed provider origin"));
    }
    Ok(url)
}

fn parse_trusted_https_url(raw_url: &str, label: &str) -> anyhow::Result<reqwest::Url> {
    let url =
        reqwest::Url::parse(raw_url).with_context(|| format!("{label} is not a valid URL"))?;
    if url.scheme() != "https" {
        return Err(anyhow!("{label} must use https"));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(anyhow!("{label} must not include credentials"));
    }
    let host = url
        .host_str()
        .filter(|host| !host.is_empty())
        .ok_or_else(|| anyhow!("{label} must include a host"))?;
    if let Ok(ip) = host.parse::<IpAddr>() {
        if !is_public_ip(ip) {
            return Err(anyhow!("{label} resolves to a non-public IP address"));
        }
    }
    Ok(url)
}

async fn assert_public_endpoint_host(url: &reqwest::Url, label: &str) -> anyhow::Result<()> {
    let host = url
        .host_str()
        .ok_or_else(|| anyhow!("{label} must include a host"))?;
    if host.parse::<IpAddr>().is_ok() {
        return Ok(());
    }
    let port = url
        .port_or_known_default()
        .ok_or_else(|| anyhow!("{label} must include a known port"))?;
    let mut addrs = tokio::net::lookup_host((host, port))
        .await
        .with_context(|| format!("{label} DNS lookup failed"))?;
    let mut saw_addr = false;
    for addr in &mut addrs {
        saw_addr = true;
        if !is_public_ip(addr.ip()) {
            return Err(anyhow!(
                "{label} resolves to a non-public IP address ({})",
                addr.ip()
            ));
        }
    }
    if !saw_addr {
        return Err(anyhow!("{label} did not resolve to any IP addresses"));
    }
    Ok(())
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_public_ipv4(ip),
        IpAddr::V6(ip) => is_public_ipv6(ip),
    }
}

fn is_public_ipv4(ip: Ipv4Addr) -> bool {
    let octets = ip.octets();
    !matches!(
        octets,
        [0, _, _, _]
            | [10, _, _, _]
            | [100, 64..=127, _, _]
            | [127, _, _, _]
            | [169, 254, _, _]
            | [172, 16..=31, _, _]
            | [192, 0, 0, _]
            | [192, 0, 2, _]
            | [192, 168, _, _]
            | [198, 18..=19, _, _]
            | [198, 51, 100, _]
            | [203, 0, 113, _]
            | [224..=239, _, _, _]
            | [240..=255, _, _, _]
    )
}

fn is_public_ipv6(ip: Ipv6Addr) -> bool {
    if let Some(mapped) = ip.to_ipv4_mapped() {
        return is_public_ipv4(mapped);
    }

    let segments = ip.segments();
    let first = segments[0];
    !(ip.is_unspecified()
        || ip.is_loopback()
        || (first & 0xfe00) == 0xfc00
        || (first & 0xffc0) == 0xfe80
        || (first & 0xff00) == 0xff00
        || (segments[0] == 0x0064 && segments[1] == 0xff9b && segments[2] == 0)
        || (segments[0] == 0x0064 && segments[1] == 0xff9b && segments[2] == 0x0001)
        || (segments[0] == 0x0100 && segments[1] == 0)
        || (segments[0] == 0x2001 && segments[1] <= 0x01ff)
        || (segments[0] == 0x2001 && segments[1] == 0x0002)
        || (segments[0] == 0x2001 && segments[1] == 0x0db8))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_private_and_metadata_ipv4() {
        assert!(!is_public_ip("127.0.0.1".parse().unwrap()));
        assert!(!is_public_ip("169.254.169.254".parse().unwrap()));
        assert!(!is_public_ip("10.1.2.3".parse().unwrap()));
        assert!(is_public_ip("8.8.8.8".parse().unwrap()));
    }

    #[test]
    fn blocks_private_ipv6() {
        assert!(!is_public_ip("::1".parse().unwrap()));
        assert!(!is_public_ip("fc00::1".parse().unwrap()));
        assert!(!is_public_ip("fe80::1".parse().unwrap()));
        assert!(!is_public_ip("::ffff:169.254.169.254".parse().unwrap()));
        assert!(is_public_ip("2606:4700:4700::1111".parse().unwrap()));
    }

    #[test]
    fn enforces_https_and_allowed_oauth_origin() {
        assert!(parse_trusted_oauth_url(
            "https://app.attio.com/oidc/token",
            ATTIO_OAUTH_ORIGINS,
            "token endpoint"
        )
        .is_ok());
        assert!(parse_trusted_oauth_url(
            "http://app.attio.com/oidc/token",
            ATTIO_OAUTH_ORIGINS,
            "token endpoint"
        )
        .is_err());
        assert!(parse_trusted_oauth_url(
            "https://evil.example/oidc/token",
            ATTIO_OAUTH_ORIGINS,
            "token endpoint"
        )
        .is_err());
    }
}
