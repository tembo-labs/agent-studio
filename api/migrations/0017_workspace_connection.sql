-- Workspace connections — TAS-owned credential substrate for external
-- services an agent's Python tools reach into at run time (Slack,
-- Google Sheets, etc.). A connection is identified by (workspace_id,
-- type, name); an agent's spec declares its connections by `name` so
-- a workspace can have multiple Slacks ("tembo-slack", "customer-slack")
-- without collision.
--
-- `credentials` is the same AES-256-GCM packed blob shape the
-- workspace_secret table uses (nonce || body || tag) — the application
-- crypto helper owns the layout. The plaintext payload is a
-- JSON-encoded credential bag whose shape varies by type:
--   slack          : { access_token, scope, bot_user_id, team_id }
--   google-sheets  : { access_token, refresh_token, expires_at, scope }
--
-- `metadata` is a JSONB column for non-secret display info we surface
-- in the Settings → Connections UI without ever decrypting (team name,
-- authorizing user's email, etc.). Keeping it out of `credentials`
-- means the list view does no decryption work.
--
-- The CHECK on `type` is intentionally narrow for v0.3 MVP. New types
-- land via a later migration that extends the check — same pattern as
-- workspace_secret's `kind`.

CREATE TABLE IF NOT EXISTS workspace_connection (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    type          TEXT        NOT NULL,
    name          TEXT        NOT NULL,
    credentials   BYTEA       NOT NULL,
    metadata      JSONB       NOT NULL DEFAULT '{}'::JSONB,
    created_by    TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, type, name),
    CHECK (type IN ('slack', 'google-sheets'))
);

CREATE INDEX IF NOT EXISTS workspace_connection_workspace_id_idx
    ON workspace_connection(workspace_id);
