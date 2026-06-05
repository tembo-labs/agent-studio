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

const NATIVE_MCP_OAUTH_ALLOWLIST: &[(&str, &[&str])] = &[
    (ATTIO_MCP_ORIGIN, ATTIO_OAUTH_ORIGINS),
    (PYLON_MCP_ORIGIN, PYLON_OAUTH_ORIGINS),
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
        match refresh_one(pool, key, http, id, &mcp_url, &ciphertext, &metadata).await {
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

async fn refresh_one(
    pool: &PgPool,
    key: &MasterKey,
    http: &reqwest::Client,
    id: uuid::Uuid,
    mcp_url: &Option<String>,
    ciphertext: &[u8],
    metadata: &serde_json::Value,
) -> anyhow::Result<()> {
    let mcp_url = mcp_url
        .as_deref()
        .filter(|u| !u.is_empty())
        .ok_or_else(|| anyhow!("connection has no mcp_server_url"))?;

    let plaintext = key.decrypt(ciphertext).context("decrypt credentials")?;
    let creds: serde_json::Value =
        serde_json::from_str(&plaintext).context("credentials not JSON")?;
    let refresh_token = creds
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow!("no refresh_token stored — reconnect required"))?;
    // The DCR-issued public client_id we registered at authorize time;
    // the refresh exchange must present the same client identity.
    let client_id = metadata
        .get("dcr_client_id")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow!("no dcr_client_id in connection metadata"))?;

    let token_endpoint = discover_token_endpoint(http, mcp_url).await?;

    // Public client (token_endpoint_auth_method=none) → no secret.
    let res = http
        .post(token_endpoint)
        .header("Accept", "application/json")
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", client_id),
        ])
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
    let new_creds = serde_json::json!({
        "access_token": access_token,
        "refresh_token": new_refresh,
        "expires_at": expires_at.map(|t| t.to_rfc3339()),
        "scope": token.scope,
        "token_type": token.token_type,
    });
    let blob = key
        .encrypt(&new_creds.to_string())
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

/// Resolve a provider's token endpoint from its MCP URL via the same
/// two-hop discovery the web authorize route uses: the resource
/// server's protected-resource metadata points at an authorization
/// server, whose metadata carries the token endpoint. We rediscover
/// each refresh rather than storing the endpoint, so it stays correct
/// without a migration or re-auth for already-connected rows.
async fn discover_token_endpoint(
    http: &reqwest::Client,
    mcp_url: &str,
) -> anyhow::Result<reqwest::Url> {
    let mcp_url = parse_trusted_https_url(mcp_url, "mcp_server_url")?;
    assert_public_endpoint_host(&mcp_url, "mcp_server_url").await?;
    let origin = mcp_url.origin().ascii_serialization();
    let allowed_oauth_origins = allowed_oauth_origins_for_mcp_origin(&origin).ok_or_else(|| {
        anyhow!("mcp_server_url origin is not in the native-MCP provider allowlist")
    })?;

    // RFC 9728: protected-resource metadata lives at the origin.
    let pr_url = reqwest::Url::parse(&format!("{origin}/.well-known/oauth-protected-resource"))
        .context("failed to build protected-resource metadata URL")?;
    let pr: ProtectedResourceMeta = http
        .get(pr_url)
        .header("Accept", "application/json")
        .send()
        .await
        .context("protected-resource discovery failed")?
        .error_for_status()
        .context("protected-resource discovery returned an error status")?
        .json()
        .await
        .context("protected-resource metadata not JSON")?;

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
