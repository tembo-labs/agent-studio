-- The model's own one-line "what I'm doing this step" note, captured per model
-- request from the text part it emitted alongside that step's tool calls (see
-- run_pydantic.py OUTPUT_DISCIPLINE — the one allowed line of narration). NULL
-- for steps with no such line, and for the final answer-only step (that text is
-- the run output, not a step summary).

ALTER TABLE run_step
    ADD COLUMN IF NOT EXISTS summary TEXT;
