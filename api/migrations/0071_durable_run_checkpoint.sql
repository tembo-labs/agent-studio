-- Persist everything the API needs to reconstruct a Pydantic run after a
-- process or host restart. message_history is pydantic-ai's typed JSON wire
-- format; execution_* is the immutable launch envelope captured at enqueue.
ALTER TABLE run
    ADD COLUMN IF NOT EXISTS execution_framework TEXT,
    ADD COLUMN IF NOT EXISTS execution_spec_content TEXT,
    ADD COLUMN IF NOT EXISTS execution_spec_format TEXT,
    ADD COLUMN IF NOT EXISTS execution_tools_module_content TEXT,
    ADD COLUMN IF NOT EXISTS execution_skills_content JSONB,
    ADD COLUMN IF NOT EXISTS message_history JSONB,
    ADD COLUMN IF NOT EXISTS checkpointed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resume_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ;
