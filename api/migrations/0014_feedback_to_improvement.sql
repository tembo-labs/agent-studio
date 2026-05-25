-- Rename the feedback feature to "improvements" everywhere. The
-- product surface always called these submissions improvements
-- ("Improve the Agent" form, "Improvements delivery" mode); the
-- table name was the only place the original "feedback" wording
-- still leaked through. Rename the table, the text column, and the
-- indexes to match.

ALTER TABLE feedback RENAME TO improvement;
ALTER TABLE improvement RENAME COLUMN feedback_text TO improvement_text;

ALTER INDEX feedback_workspace_created_idx
    RENAME TO improvement_workspace_created_idx;
ALTER INDEX feedback_run_idx
    RENAME TO improvement_run_idx;
