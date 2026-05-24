-- Token-usage telemetry for each run. Captured from the provider
-- response when available; the run detail page renders them as
-- "Consumed N tokens (~$0.0X)" using a model→rate map in TS.
--
-- Nullable on both: not every provider returns usage on every error
-- path, and historical rows pre-date this column.

ALTER TABLE run
    ADD COLUMN IF NOT EXISTS tokens_input  INTEGER,
    ADD COLUMN IF NOT EXISTS tokens_output INTEGER;
