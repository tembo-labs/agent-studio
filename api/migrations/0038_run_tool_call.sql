-- Tool calls made by an agent during a run, captured from the pydantic-ai
-- message history (pydantic agents only; cargo-ai exposes none). One row
-- per call, in call order. We store the tool name + outcome, NOT the
-- arguments or results — those can carry secrets/PII and bloat the table.
--   ok = true   → the tool returned successfully
--   ok = false  → the tool errored (the model got a RetryPrompt)
--   ok = null   → the call had no return (the run ended/failed first)

CREATE TABLE IF NOT EXISTS run_tool_call (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id        UUID        NOT NULL REFERENCES run(id) ON DELETE CASCADE,
    ordinal       INT         NOT NULL,
    tool_name     TEXT        NOT NULL,
    ok            BOOLEAN,
    error_message TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS run_tool_call_run_idx ON run_tool_call (run_id, ordinal);
CREATE INDEX IF NOT EXISTS run_tool_call_name_idx ON run_tool_call (tool_name);
