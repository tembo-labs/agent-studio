-- Workspace-scoped secrets (Tembo API key, GitHub PAT, …) encrypted at
-- rest with AES-256-GCM. The packed `ciphertext` blob is nonce || body ||
-- auth-tag — the application crypto helper owns that layout.
--
-- `last4` is plaintext of the last four characters of the original secret,
-- used to render a masked preview ("…wXyZ") in the settings UI without
-- ever decrypting. Suitable for high-entropy API keys; do not adopt this
-- pattern for short / low-entropy secrets.
--
-- Generalized as (workspace_id, kind) so the slice-3 GitHub PAT reuses
-- this table instead of a parallel one.

CREATE TABLE IF NOT EXISTS workspace_secret (
    workspace_id  UUID      NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    kind          TEXT      NOT NULL,
    ciphertext    BYTEA     NOT NULL,
    last4         TEXT      NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, kind),
    CHECK (kind IN ('tembo_api_key'))
);
