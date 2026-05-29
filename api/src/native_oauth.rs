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

use crate::crypto::MasterKey;

/// Refresh tokens already expired or within this window of expiring,
/// so a token can't die mid-run between the sweep and the agent's
/// first tool call.
const REFRESH_SKEW_SECS: i64 = 120;

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
        .post(&token_endpoint)
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
    let expires_at: Option<DateTime<Utc>> =
        token.expires_in.map(|secs| Utc::now() + Duration::seconds(secs));

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
) -> anyhow::Result<String> {
    let origin = reqwest::Url::parse(mcp_url)
        .context("bad mcp_server_url")?
        .origin()
        .ascii_serialization();

    // RFC 9728: protected-resource metadata lives at the origin.
    let pr_url = format!("{origin}/.well-known/oauth-protected-resource");
    let pr: ProtectedResourceMeta = http
        .get(&pr_url)
        .header("Accept", "application/json")
        .send()
        .await
        .context("protected-resource discovery failed")?
        .error_for_status()
        .context("protected-resource discovery returned an error status")?
        .json()
        .await
        .context("protected-resource metadata not JSON")?;

    let as_base = pr
        .authorization_servers
        .and_then(|v| v.into_iter().next())
        .ok_or_else(|| anyhow!("no authorization_servers in protected-resource metadata"))?;

    let as_meta_url = format!(
        "{}/.well-known/oauth-authorization-server",
        as_base.trim_end_matches('/')
    );
    let asm: AuthServerMeta = http
        .get(&as_meta_url)
        .header("Accept", "application/json")
        .send()
        .await
        .context("authorization-server discovery failed")?
        .error_for_status()
        .context("authorization-server discovery returned an error status")?
        .json()
        .await
        .context("authorization-server metadata not JSON")?;

    asm.token_endpoint
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow!("authorization-server metadata missing token_endpoint"))
}
