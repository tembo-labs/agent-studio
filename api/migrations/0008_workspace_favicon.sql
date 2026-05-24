-- Per-workspace favicon. Workspace admins pick one of four built-in
-- defaults or upload a custom image (PNG/SVG/ICO, ≤ 200 KB). The bytes
-- ride in the workspace row as BYTEA — small, single-node-friendly,
-- moves to object storage if/when v0.3+ pushes us off Postgres.

ALTER TABLE workspace
    ADD COLUMN IF NOT EXISTS favicon_kind TEXT NOT NULL DEFAULT 'default-tembo'
        CHECK (favicon_kind IN (
            'default-tembo', 'default-agent', 'default-bolt', 'default-cube',
            'custom'
        )),
    ADD COLUMN IF NOT EXISTS favicon_blob BYTEA,
    ADD COLUMN IF NOT EXISTS favicon_mime TEXT;

-- Application-level invariant: when favicon_kind = 'custom', both
-- favicon_blob and favicon_mime must be present. Enforced in the
-- service layer; not worth a separate CHECK that depends on multiple
-- nullable columns.
