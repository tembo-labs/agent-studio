-- Distinguish chat-to-edit improvements from chat-to-create
-- improvements so the Agents grid can show pending creates while the
-- PR is in flight. 'edit' is the default — every row that existed
-- before this migration came from a chat-to-edit or run-improve flow.

ALTER TABLE improvement
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'edit'
    CHECK (kind IN ('edit', 'create'));

-- Index for the Agents page query: workspace-scoped, non-terminal,
-- kind='create'. Small partial index keeps the read path cheap as the
-- improvement table grows.
CREATE INDEX IF NOT EXISTS improvement_workspace_pending_create_idx
    ON improvement (workspace_id, created_at DESC)
    WHERE kind = 'create' AND status IN ('submitted', 'pr_opened');
