-- A list of deep links the producer wants the human to open, on top of the
-- single source link in external_url. Lets one inbox item point at several
-- things to review — e.g. "the top 10 Linear triage tickets" filed as one task,
-- with a clickable link to each. Shape: JSONB array of { label?: string, url:
-- string }; urls are validated http(s) at produce time. Nullable (most items
-- have none).
ALTER TABLE inbox_item ADD COLUMN IF NOT EXISTS links JSONB;
