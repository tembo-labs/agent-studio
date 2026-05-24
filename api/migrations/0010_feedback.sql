-- Feedback submitted from a run-detail "Improve me" form. One row
-- per submission. We embed the feedback id into the prompt we send
-- to Tembo so the resulting PR can include a `TAS-Feedback-ID: <id>`
-- marker — that's how we later link a merged PR back to the
-- feedback row.
--
-- Status lifecycle:
--   submitted  → row exists, Tembo task may have been created
--   pr_opened  → we matched a GitHub PR via the marker; pr_url set
--   merged     → the PR was merged; the feedback "took"
--   closed     → the PR was closed without merging
--
-- PR detection is poll-on-demand for now: when the user visits
-- /<workspace>/feedbacks we scan GitHub for PRs with the marker
-- and update the rows.

CREATE TABLE IF NOT EXISTS feedback (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    run_id                UUID NOT NULL REFERENCES run(id) ON DELETE CASCADE,
    agent_name            TEXT NOT NULL,
    agent_path            TEXT NOT NULL,
    feedback_text         TEXT NOT NULL,
    tembo_task_id         TEXT,
    tembo_task_html_url   TEXT,
    pr_url                TEXT,
    pr_number             INTEGER,
    pr_state              TEXT, -- 'open' | 'merged' | 'closed'
    status                TEXT NOT NULL DEFAULT 'submitted',
        -- 'submitted' | 'pr_opened' | 'merged' | 'closed'
    created_by            TEXT NOT NULL REFERENCES "user"(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_workspace_created_idx
    ON feedback (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS feedback_run_idx
    ON feedback (run_id);
