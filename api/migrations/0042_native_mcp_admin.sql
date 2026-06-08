-- Native MCP admin surface: per-workspace provider enablement + multiple
-- bring-your-own OAuth "app instances" per manual provider.
--
-- Two changes:
--
--  1. workspace_native_mcp_provider — which native-MCP providers a workspace
--     admin has turned on for regular users. Absence of a row is interpreted in
--     the lib layer (DCR providers default on; manual providers default off and
--     additionally need >=1 configured app instance), so this table only needs
--     to record explicit admin choices.
--
--  2. workspace_native_oauth_client gains an `instance` slug (+ optional human
--     `label`) so an admin can register MORE THAN ONE OAuth app per manual
--     provider (e.g. a HubSpot app per portal). A connection records which
--     instance it used (metadata.instance) so refresh presents the right
--     client_secret. Existing rows backfill to instance='default' via the
--     column DEFAULT; the unique constraint moves from (workspace, provider) to
--     (workspace, provider, instance).

CREATE TABLE IF NOT EXISTS workspace_native_mcp_provider (
    workspace_id UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    provider     TEXT        NOT NULL,
    enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
    updated_by   TEXT        REFERENCES "user"(id) ON DELETE SET NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, provider)
);

ALTER TABLE workspace_native_oauth_client
    ADD COLUMN IF NOT EXISTS instance TEXT NOT NULL DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS label    TEXT;

-- Swap the single-app-per-provider constraint for one-per-instance. The old
-- constraint is auto-named workspace_native_oauth_client_workspace_id_provider_key.
ALTER TABLE workspace_native_oauth_client
    DROP CONSTRAINT IF EXISTS workspace_native_oauth_client_workspace_id_provider_key;
ALTER TABLE workspace_native_oauth_client
    ADD CONSTRAINT workspace_native_oauth_client_ws_provider_instance_key
    UNIQUE (workspace_id, provider, instance);
