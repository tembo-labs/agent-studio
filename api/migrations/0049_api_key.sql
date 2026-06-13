-- Per-user, workspace-bound API keys. A workspace_api_key row authenticates a
-- programmatic caller (Claude Code via MCP, or any REST client) as a specific
-- (workspace, user) pair: requests carry `Authorization: Bearer tas_<token>` and
-- act AS `user_id` so the run executes with that user's per-user connections.
-- The key's effective role is resolved at request time from workspace_member,
-- so demoting/removing the user immediately changes API power (no role baked in).
--
-- Token model mirrors workspace_webhook (encrypted at rest with the shared
-- AES-256-GCM master key, nonce || ciphertext || tag; shown once on creation;
-- token_last4 is plaintext only for the masked preview) with one addition: a
-- bearer arrives with no URL selector, so we cannot decrypt-and-compare every
-- row. token_lookup_hash = sha256hex(token) gives an O(1), unique lookup; the
-- route then still constant-time compares the decrypted ciphertext as defense
-- in depth. The hash is keyless (no master key) so lookup never decrypts.

CREATE TABLE IF NOT EXISTS workspace_api_key (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    user_id           TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    name              TEXT        NOT NULL,
    token_lookup_hash TEXT        NOT NULL UNIQUE,
    token_ciphertext  BYTEA       NOT NULL,
    token_last4       TEXT        NOT NULL,
    enabled           BOOLEAN     NOT NULL DEFAULT TRUE,
    last_used_at      TIMESTAMPTZ,
    created_by        TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_api_key_ws_idx
    ON workspace_api_key (workspace_id);
