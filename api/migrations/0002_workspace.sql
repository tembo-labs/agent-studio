-- Workspaces are the top-level tenancy unit. Every agent, run, repo
-- connection, and Tembo API key is scoped to one workspace. A user can
-- belong to many workspaces; a workspace must always have at least one
-- member (enforced at application level for now — the DB only enforces
-- referential integrity).

CREATE TABLE IF NOT EXISTS workspace (
    id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT      NOT NULL,
    slug        TEXT      NOT NULL UNIQUE,
    created_by  TEXT      NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- workspace_member.role is intentionally low-cardinality in v0.1
-- ('admin' only). v0.4 introduces RBAC and adds reviewer/operator/auditor.
-- Keeping the column now means later migrations only add CHECK constraints,
-- not a schema reshape.
CREATE TABLE IF NOT EXISTS workspace_member (
    workspace_id  UUID      NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    user_id       TEXT      NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    role          TEXT      NOT NULL DEFAULT 'admin',
    joined_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_member_user_id_idx ON workspace_member(user_id);
