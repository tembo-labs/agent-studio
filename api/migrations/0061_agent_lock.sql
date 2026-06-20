-- Per-agent "Locked" flag — an admin lockdown for governed agents (e.g.
-- regulated drafting) so end users can't drive changes or adaptation. When an
-- agent is locked, the in-app edit affordances (Chat to edit, Improve, and
-- correction/learning capture) are removed and the change/learning history tabs
-- (Versions, Activity, Learning) are hidden; the agent then changes ONLY via
-- direct repo PRs. Setting it is Workspace-Admin-only and audited.
--
-- One row per (workspace, agent); a row with locked = true means locked.
-- Web-owned table; the Rust API just applies the migration on boot.
CREATE TABLE IF NOT EXISTS agent_lock (
    workspace_id UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    agent_name   TEXT        NOT NULL,
    locked       BOOLEAN     NOT NULL DEFAULT TRUE,
    updated_by   TEXT        REFERENCES "user"(id) ON DELETE SET NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, agent_name)
);

-- "Which agents in this workspace are locked?" — the scheduler excludes locked
-- agents from the learning loop and the UI hides edit affordances for them.
CREATE INDEX IF NOT EXISTS agent_lock_locked_idx
    ON agent_lock (workspace_id)
    WHERE locked;
