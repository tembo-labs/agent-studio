//! Minimal workspace queries needed by the runtime — secret lookup only.
//! The web layer owns the full CRUD surface; this stays narrow.

use anyhow::{anyhow, Context};
use sqlx::PgPool;

use crate::crypto::MasterKey;

#[derive(Debug, Clone, Copy)]
pub enum SecretKind {
    AnthropicApiKey,
    OpenAiApiKey,
    ComposioApiKey,
}

impl SecretKind {
    fn as_db_str(self) -> &'static str {
        match self {
            SecretKind::AnthropicApiKey => "anthropic_api_key",
            SecretKind::OpenAiApiKey => "openai_api_key",
            SecretKind::ComposioApiKey => "composio_api_key",
        }
    }
}

/// Map of (toolkit slug → Composio connected_account id) for a
/// workspace's ACTIVE composio connections. The Pydantic runner
/// passes this to the Composio session so it pins the right
/// connections without needing the management meta-tool.
pub async fn list_active_composio_connections(
    pool: &PgPool,
    workspace_id: uuid::Uuid,
) -> anyhow::Result<Vec<(String, String)>> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT toolkit_slug, composio_connection_id \
           FROM workspace_composio_connection \
          WHERE workspace_id = $1 AND status = 'ACTIVE'",
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await
    .context("failed to list workspace_composio_connection")?;
    Ok(rows)
}

/// Returns the decrypted plaintext for a workspace secret. Mirrors the
/// TS-side `getWorkspaceSecretPlaintext` — the web app encrypts on save,
/// the runtime decrypts on use.
pub async fn get_workspace_secret_plaintext(
    pool: &PgPool,
    key: &MasterKey,
    workspace_id: uuid::Uuid,
    kind: SecretKind,
) -> anyhow::Result<String> {
    let row: Option<(Vec<u8>,)> = sqlx::query_as(
        "SELECT ciphertext FROM workspace_secret \
         WHERE workspace_id = $1 AND kind = $2",
    )
    .bind(workspace_id)
    .bind(kind.as_db_str())
    .fetch_optional(pool)
    .await
    .context("failed to read workspace_secret")?;

    let ciphertext = row
        .ok_or_else(|| anyhow!("workspace secret {} not set", kind.as_db_str()))?
        .0;
    key.decrypt(&ciphertext)
}
