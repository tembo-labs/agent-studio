-- Live partial output for an in-flight run.
--
-- The runner used to capture the wrapper's stdout only at process exit, so the
-- run-detail page showed "Running…" until everything landed at once. The
-- wrapper now streams text deltas + tool-call progress as it works; the runner
-- writes the reconstructed live text here (debounced) while status='running',
-- and the page renders it. The authoritative final transcript still lands in
-- run.output on completion, so this column is only read while a run is live.

ALTER TABLE run
    ADD COLUMN IF NOT EXISTS streamed_output TEXT;
