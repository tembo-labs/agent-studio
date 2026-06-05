-- Secrets: the 3rd connection substrate. A free-form, per-workspace API key
-- (e.g. Clay) that sidecar Python tools read via tas_tools.secret("<slug>").
--
-- Unlike workspace_connection (Native MCP) and workspace_composio_connection,
-- which are per-(workspace, user) because OAuth ties to a person, a Secret is
-- ONE org-wide value set by an admin — so there is no user_id and the unique
-- key is just (workspace_id, slug). The value is encrypted with the same
-- AES-256-GCM master key as every other secret (nonce || ciphertext || tag),
-- interchangeable between the web and Rust sides; last4 is kept in cleartext
-- only for the masked preview.
--
-- Distinct from `workspace_secret` (the enumerated provider/Composio/Tembo
-- keys): that table is a fixed CHECK-constrained set of typed keys; this one
-- holds arbitrary user-named service credentials.

CREATE TABLE IF NOT EXISTS workspace_secret_connection (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    slug         TEXT        NOT NULL,
    description  TEXT,
    ciphertext   BYTEA       NOT NULL,
    last4        TEXT        NOT NULL,
    created_by   TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS workspace_secret_connection_ws_idx
    ON workspace_secret_connection (workspace_id);
