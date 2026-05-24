-- Agent runs: one row per "Run now" click. Status transitions
--   queued → running → succeeded | failed
-- are the contract the v0.1 UI polls. `output` is the cumulative
-- stdout+stderr of the provider call, appended in place by the spawner
-- task so the UI can tail it.
--
-- v0.4 will move runs to a richer event-stream model for the audit
-- timeline; the simple TEXT column here is intentionally a v0.1 floor.

CREATE TABLE IF NOT EXISTS run (
    id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID      NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    agent_name      TEXT      NOT NULL,
    agent_path      TEXT      NOT NULL,
    model           TEXT      NOT NULL,
    status          TEXT      NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    output          TEXT      NOT NULL DEFAULT '',
    error_message   TEXT,
    created_by      TEXT      NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS run_workspace_recent_idx
    ON run(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS run_workspace_agent_recent_idx
    ON run(workspace_id, agent_name, created_at DESC);

-- Allow Anthropic API keys alongside Tembo API keys and GitHub PATs.
ALTER TABLE workspace_secret DROP CONSTRAINT IF EXISTS workspace_secret_kind_check;
ALTER TABLE workspace_secret
    ADD CONSTRAINT workspace_secret_kind_check
    CHECK (kind IN ('tembo_api_key', 'github_pat', 'anthropic_api_key'));
