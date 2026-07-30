-- Optional member-scoped credentials. Tembo authoring resolves the acting
-- member's key first, then falls back to the existing workspace credential.

CREATE TABLE IF NOT EXISTS workspace_user_secret (
    workspace_id  UUID        NOT NULL,
    user_id       TEXT        NOT NULL,
    kind          TEXT        NOT NULL,
    ciphertext    BYTEA       NOT NULL,
    last4         TEXT        NOT NULL,
    metadata      JSONB       NOT NULL DEFAULT '{}'::JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id, kind),
    FOREIGN KEY (workspace_id, user_id)
        REFERENCES workspace_member(workspace_id, user_id) ON DELETE CASCADE,
    CHECK (kind IN ('tembo_api_key'))
);

CREATE INDEX IF NOT EXISTS workspace_user_secret_user_id_idx
    ON workspace_user_secret(user_id);
