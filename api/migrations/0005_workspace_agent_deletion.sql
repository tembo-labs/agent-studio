-- Soft deletion record for agents. When an operator deletes an agent from
-- the UI, the file is removed from the connected Git repo *and* a row is
-- written here with a full content snapshot, so the v0.1 "Restore deleted
-- agents" surface can recreate the file later without having to walk Git
-- history. Restored rows stay in the table (with `restored_at` set) so the
-- v0.4 audit timeline has a record of both events.

CREATE TABLE IF NOT EXISTS workspace_agent_deletion (
    id                      UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID      NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    agent_name              TEXT      NOT NULL,
    file_path               TEXT      NOT NULL,
    content_snapshot        TEXT      NOT NULL,
    deletion_commit_sha     TEXT      NOT NULL,
    deleted_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_by              TEXT      NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    -- NULL while the deletion is still live. Set to the restore time when
    -- an operator brings the agent back; we keep the row so the audit
    -- trail shows both events rather than a quietly vanished tombstone.
    restored_at             TIMESTAMP,
    restored_by             TEXT      REFERENCES "user"(id) ON DELETE RESTRICT,
    restore_commit_sha      TEXT
);

CREATE INDEX IF NOT EXISTS workspace_agent_deletion_workspace_active_idx
    ON workspace_agent_deletion(workspace_id, deleted_at DESC)
    WHERE restored_at IS NULL;
