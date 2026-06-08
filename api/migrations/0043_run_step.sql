-- Per-step (per model-request) token usage for a run.
--
-- pydantic-ai records one ModelResponse per LLM request; each carries its own
-- usage and the tool calls the model emitted that turn. Until now we stored
-- only a single aggregate (run.tokens_input/output) and a flat list of tool
-- calls (run_tool_call) with no link to the request that produced them. This
-- adds one row per model step so the run-detail UI can attribute tokens to the
-- step that fired each tool call.
--
-- Note on semantics: input_tokens are cumulative-by-nature — each request
-- resends the growing conversation history — so summing them across steps
-- equals run.tokens_input. output_tokens are the tokens the model generated
-- that step (the clean per-step figure). The UI surfaces both, labelled.

CREATE TABLE IF NOT EXISTS run_step (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id             UUID        NOT NULL REFERENCES run(id) ON DELETE CASCADE,
    ordinal            INT         NOT NULL,  -- 0-based model-request index in the run
    input_tokens       INTEGER,
    output_tokens      INTEGER,
    cache_read_tokens  INTEGER,
    cache_write_tokens INTEGER,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, ordinal)
);

CREATE INDEX IF NOT EXISTS run_step_run_idx ON run_step (run_id, ordinal);

-- Which model step emitted each tool call (NULL for runs recorded before this,
-- or when the wrapper couldn't attribute a call to a response).
ALTER TABLE run_tool_call
    ADD COLUMN IF NOT EXISTS step_ordinal INT;
