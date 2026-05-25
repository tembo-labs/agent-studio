-- Automations: a saved (agent, trigger) pairing that fires runs on
-- its own. v0.2 only ships schedule triggers; event triggers
-- (US-0.2-08) land later and will add a trigger_kind enum then.
--
-- An automation references an agent by NAME, not by FK — agents live
-- in the workspace's repo, not in this database, so there's no row
-- to point at. If the underlying agent file disappears or is
-- renamed, the scheduler records a fire error on the automation
-- but keeps trying so the user can fix the discrepancy.
--
-- cron is interpreted in UTC. We intentionally do not store a
-- timezone column yet — DST handling is a known footgun and the
-- v0.2 scope was "basic". When we add tz, we'll add a column and
-- backfill it to 'UTC'.
--
-- last_fired_at is the floor the scheduler uses to decide whether
-- a firing is due. Surviving a restart works because we only fire
-- on transitions strictly after last_fired_at, so a crash that
-- happens mid-fire never double-fires.

CREATE TABLE IF NOT EXISTS automation (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    agent_name      TEXT        NOT NULL,
    cron            TEXT        NOT NULL,
    input_message   TEXT        NOT NULL DEFAULT '',
    enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
    last_fired_at   TIMESTAMPTZ,
    last_fire_error TEXT,
    created_by      TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_workspace_idx
    ON automation (workspace_id);
CREATE INDEX IF NOT EXISTS automation_workspace_agent_idx
    ON automation (workspace_id, agent_name);

-- Two columns on `run` so the UI can show how a run was triggered
-- and link back to the automation when applicable. Default is
-- 'manual' so existing rows keep working without a backfill.

ALTER TABLE run ADD COLUMN IF NOT EXISTS trigger TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger IN ('manual', 'schedule'));
ALTER TABLE run ADD COLUMN IF NOT EXISTS automation_id UUID
    REFERENCES automation(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS run_automation_idx
    ON run (automation_id) WHERE automation_id IS NOT NULL;
