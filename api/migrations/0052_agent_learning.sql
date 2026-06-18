-- Per-agent "learning mode" config for the Tasks Inbox learning loop.
--
-- When an agent is in learning mode, the scheduler's learning pass periodically
-- (cadence) gathers the unconsumed inbox signals it produced — the diffs
-- between what it proposed and what the human submitted — and collapses them
-- into ONE improvement -> Tembo Coding Agent PR (reusing requestAgentChange).
-- This is the batched alternative to opening a PR per signal.
--
-- One row per (workspace, agent). owner_user_id is who the batched improvement
-- is attributed to and whose workspace the CAP task runs against (mirrors
-- automation.owner_user_id); required to be set while enabled because
-- improvement.created_by is NOT NULL.

CREATE TABLE IF NOT EXISTS agent_learning (
    workspace_id    UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    agent_name      TEXT        NOT NULL,
    enabled         BOOLEAN     NOT NULL DEFAULT FALSE,
    cadence         TEXT        NOT NULL DEFAULT 'daily'
        CHECK (cadence IN ('daily', 'weekly')),
    owner_user_id   TEXT        REFERENCES "user"(id) ON DELETE SET NULL,
    -- Floor for the next cycle (like automation.last_fired_at). NULL = never run.
    last_learned_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, agent_name)
);

-- The scheduler's "which agents are due?" scan walks enabled rows across all
-- workspaces each cycle.
CREATE INDEX IF NOT EXISTS agent_learning_enabled_idx
    ON agent_learning(enabled)
    WHERE enabled;
