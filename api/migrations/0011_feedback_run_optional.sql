-- Chat-to-edit lets a user request a change to an agent without
-- referencing a specific run — the thread lives at the agent level.
-- Make feedback.run_id nullable so chat-thread submissions can
-- coexist in the same table as run-anchored "Improve me" feedback.

ALTER TABLE feedback ALTER COLUMN run_id DROP NOT NULL;
