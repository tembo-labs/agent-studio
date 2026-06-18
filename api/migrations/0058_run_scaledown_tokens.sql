-- ScaleDown prompt-compression totals for a run, so the run detail can show
-- what compression saved. Nullable: only set when an agent opted into
-- `scaledown:` and the workspace had a key + something was actually compressed.
ALTER TABLE run
    ADD COLUMN IF NOT EXISTS scaledown_original_tokens   INTEGER,
    ADD COLUMN IF NOT EXISTS scaledown_compressed_tokens INTEGER;
