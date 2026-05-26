-- Workspace connections — Composio-backed (the "basic mode" path).
-- Distinct from `workspace_connection` (the TAS-owned OAuth substrate,
-- migration 0017) because the two have different lifecycles:
--   * Composio owns the OAuth app + token vault; we just cache an
--     opaque connection id and the auth-config id Composio assigned
--     when the link was created.
--   * TAS-owned (0017) stores encrypted tokens directly.
-- Keeping them in separate tables means upgrading a workspace from
-- "basic" to "advanced" later won't require a destructive in-place
-- conversion.
--
-- v0.3 ships one connection per (workspace, toolkit_slug). Multi-
-- instance (e.g., two Slacks per workspace) lands when the UI starts
-- exposing connection names — the schema will absorb that with an
-- ALTER … ADD COLUMN name + a new unique constraint.

CREATE TABLE IF NOT EXISTS workspace_composio_connection (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id           UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    toolkit_slug           TEXT        NOT NULL,
    composio_connection_id TEXT        NOT NULL,
    auth_config_id         TEXT        NOT NULL,
    status                 TEXT        NOT NULL DEFAULT 'active',
    metadata               JSONB       NOT NULL DEFAULT '{}'::JSONB,
    created_by             TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, toolkit_slug)
);

CREATE INDEX IF NOT EXISTS workspace_composio_connection_workspace_idx
    ON workspace_composio_connection(workspace_id);
