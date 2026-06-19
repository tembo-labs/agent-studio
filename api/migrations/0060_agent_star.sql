-- Per-user agent "stars" — a personal visibility flag so each member can curate
-- which agents they see day-to-day (the agents list defaults to owned + starred
-- with a "view all" toggle). Distinct from the shared `labels:` taxonomy.
-- Web-owned table; the Rust API just applies the migration on boot.
CREATE TABLE IF NOT EXISTS agent_star (
    workspace_id UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    user_id      TEXT        NOT NULL REFERENCES "user"(id)    ON DELETE CASCADE,
    agent_name   TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id, agent_name)
);

-- "List the agents I've starred in this workspace."
CREATE INDEX IF NOT EXISTS agent_star_ws_user_idx
    ON agent_star (workspace_id, user_id);
