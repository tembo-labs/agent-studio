//! Minimal workspace queries needed by the runtime — secret lookup only.
//! The web layer owns the full CRUD surface; this stays narrow.

use anyhow::{anyhow, Context};
use sqlx::PgPool;

use crate::crypto::MasterKey;

#[derive(Debug, Clone, Copy)]
pub enum SecretKind {
    AnthropicApiKey,
}

impl SecretKind {
    fn as_db_str(self) -> &'static str {
        match self {
            SecretKind::AnthropicApiKey => "anthropic_api_key",
        }
    }
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
