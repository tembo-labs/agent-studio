-- One Git repository per workspace (v0.1 promise). Multi-repo is deferred
-- past v0.4 unless a customer blocks on it (see context/0.1/USER_STORIES.md
-- "Stretch (Considered, Deferred)"). Keeping the row keyed on workspace_id
-- alone enforces single-repo at the schema level; a future migration can
-- broaden the PK to (workspace_id, provider, name) without reshape.

CREATE TABLE IF NOT EXISTS workspace_repo (
    workspace_id    UUID      PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
    provider        TEXT      NOT NULL CHECK (provider = 'github'),
    owner           TEXT      NOT NULL,
    name            TEXT      NOT NULL,
    default_branch  TEXT      NOT NULL,
    connected_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    connected_by    TEXT      NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT
);

-- Allow the github_pat secret kind. The old CHECK from migration 0003 only
-- permitted 'tembo_api_key'.
ALTER TABLE workspace_secret DROP CONSTRAINT IF EXISTS workspace_secret_kind_check;
ALTER TABLE workspace_secret
    ADD CONSTRAINT workspace_secret_kind_check
    CHECK (kind IN ('tembo_api_key', 'github_pat'));
