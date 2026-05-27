-- Revive Phase A's workspace_connection substrate, now for the
-- "Native MCP" connection mode that lives alongside Composio. The
-- v0.3 build deferred this table when we picked Composio for basic
-- mode; v0.4+ brings it back to host connections that talk directly
-- to a provider's official MCP server (Attio, Notion, Linear, …)
-- instead of going through Composio's REST-wrapping layer.
--
-- Shape changes vs. the original Phase A table:
--   * Drop the Slack/Sheets-only CHECK. Provider validation now
--     happens at the app layer against lib/mcp-providers.ts; the DB
--     just stores whatever slug the catalog produced.
--   * Add user_id so connections are per-user (matching Composio's
--     v0.3 model — same TAS user can have a personal + work Attio).
--   * Add mcp_server_url + auth_type. MCP URL is duplicated from the
--     catalog so the row is self-describing if the catalog later
--     drifts; auth_type ('oauth2' | 'pat') drives the refresh path.
--   * Add token_expires_at as a denormalized field for the
--     refresh-before-use check. The same value also lives inside the
--     encrypted credentials blob, but querying it without decrypting
--     keeps the "is anything expiring soon?" sweep cheap.
--   * Add cached_tools (jsonb) + cached_tools_refreshed_at. Native
--     MCP servers self-describe via list_tools; we cache that
--     response so the UI can show "this connection exposes 47
--     tools" without round-tripping every page load.
--
-- workspace_secret gets two new kinds per provider that supports
-- OAuth (client_id is not technically a secret, but storing both
-- alongside each other keeps the rotate path clean). Adding Attio's
-- pair here; later providers extend the CHECK in their own
-- migrations.

-- ── workspace_secret kinds ────────────────────────────────────────
ALTER TABLE workspace_secret DROP CONSTRAINT IF EXISTS workspace_secret_kind_check;
ALTER TABLE workspace_secret
    ADD CONSTRAINT workspace_secret_kind_check
    CHECK (kind IN (
        'tembo_api_key',
        'github_pat',
        'anthropic_api_key',
        'openai_api_key',
        'composio_api_key',
        'composio_webhook_secret',
        'attio_oauth_client_id',
        'attio_oauth_client_secret'
    ));

-- ── workspace_connection columns ──────────────────────────────────
ALTER TABLE workspace_connection
    DROP CONSTRAINT IF EXISTS workspace_connection_type_check;

ALTER TABLE workspace_connection
    ADD COLUMN IF NOT EXISTS user_id TEXT
        REFERENCES "user"(id) ON DELETE CASCADE;
ALTER TABLE workspace_connection
    ADD COLUMN IF NOT EXISTS mcp_server_url TEXT;
ALTER TABLE workspace_connection
    ADD COLUMN IF NOT EXISTS auth_type TEXT;
ALTER TABLE workspace_connection
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
ALTER TABLE workspace_connection
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE workspace_connection
    ADD COLUMN IF NOT EXISTS cached_tools JSONB;
ALTER TABLE workspace_connection
    ADD COLUMN IF NOT EXISTS cached_tools_refreshed_at TIMESTAMPTZ;

-- Existing rows (if any from the dormant Phase A code) get
-- backfilled to created_by so we don't violate NOT NULL on user_id.
-- After backfill, tighten user_id to NOT NULL.
UPDATE workspace_connection
   SET user_id = created_by
 WHERE user_id IS NULL;

ALTER TABLE workspace_connection
    ALTER COLUMN user_id SET NOT NULL;

-- Replace the old (workspace, type, name) unique with the new
-- per-user shape. A single workspace can now hold (alice, attio,
-- default) + (bob, attio, default) without collision — same model
-- the Composio connection table uses (migration 0022).
ALTER TABLE workspace_connection
    DROP CONSTRAINT IF EXISTS workspace_connection_workspace_id_type_name_key;

ALTER TABLE workspace_connection
    ADD CONSTRAINT workspace_connection_workspace_user_type_name_key
    UNIQUE (workspace_id, user_id, type, name);

-- New status CHECK mirrors what Composio's table uses. 'stale' is
-- the same flip the runner does when a provider rejects a cached
-- token — UI surfaces a Reconnect alert.
ALTER TABLE workspace_connection
    ADD CONSTRAINT workspace_connection_status_check
    CHECK (status IN ('active', 'stale', 'expired', 'revoked'));

CREATE INDEX IF NOT EXISTS workspace_connection_workspace_user_idx
    ON workspace_connection(workspace_id, user_id);
