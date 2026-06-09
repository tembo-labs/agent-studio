-- One-time backfill of run.cost_usd after the model-pricing corrections.
--
-- cost_usd is computed once when a run finishes (api/src/runs/runner.rs) and
-- frozen on the row, so historical runs kept stale prices after we fixed:
--   - claude-opus: $15/$75 → $5/$25 per MTok
--   - openai gpt-5.x: split out of the single $1.25/$10 catch-all
--     (gpt-5.5 $5/$30, gpt-5.4 $2.50/$15 +mini/nano, gpt-5.2 $0.875/$7,
--      gpt-5.1 $0.625/$5)
--
-- This recomputes cost_usd from each row's token counts using the CURRENT rate
-- table. It MIRRORS api/src/pricing.rs / web/src/lib/pricing.ts — a frozen copy
-- is fine here since this runs once against existing data. Only rows that have
-- token counts AND match a known model family are touched; recomputing an
-- already-correct family (sonnet, haiku, gpt-4o/4.1, o3) is a no-op.
--
-- Model strings are stored as `provider:model` (e.g. `anthropic:claude-opus-4-8`,
-- `openai:gpt-5.5`). CASE order matters — most specific first — so the bare
-- `openai:gpt-5%` catch-all doesn't swallow the 5.x variants.

WITH rates AS (
    SELECT
        id,
        tokens_input,
        tokens_output,
        CASE
            WHEN model LIKE 'anthropic:%claude-fable%'  THEN 10.0
            WHEN model LIKE 'anthropic:%claude-opus%'   THEN 5.0
            WHEN model LIKE 'anthropic:%claude-sonnet%' THEN 3.0
            WHEN model LIKE 'anthropic:%claude-haiku%'  THEN 1.0
            WHEN model LIKE 'openai:gpt-5.5%'      THEN 5.0
            WHEN model LIKE 'openai:gpt-5.4-mini%' THEN 0.75
            WHEN model LIKE 'openai:gpt-5.4-nano%' THEN 0.2
            WHEN model LIKE 'openai:gpt-5.4%'      THEN 2.5
            WHEN model LIKE 'openai:gpt-5.2%'      THEN 0.875
            WHEN model LIKE 'openai:gpt-5.1%'      THEN 0.625
            WHEN model LIKE 'openai:gpt-5-mini%'   THEN 0.25
            WHEN model LIKE 'openai:gpt-5-nano%'   THEN 0.05
            WHEN model LIKE 'openai:gpt-5%'        THEN 1.25
            WHEN model LIKE 'openai:gpt-4o-mini%'  THEN 0.15
            WHEN model LIKE 'openai:gpt-4o%'       THEN 2.5
            WHEN model LIKE 'openai:gpt-4.1-nano%' THEN 0.1
            WHEN model LIKE 'openai:gpt-4.1-mini%' THEN 0.4
            WHEN model LIKE 'openai:gpt-4.1%'      THEN 2.0
            WHEN model LIKE 'openai:o3-mini%'      THEN 1.1
            WHEN model LIKE 'openai:o3%'           THEN 2.0
            ELSE NULL
        END AS in_rate,
        CASE
            WHEN model LIKE 'anthropic:%claude-fable%'  THEN 50.0
            WHEN model LIKE 'anthropic:%claude-opus%'   THEN 25.0
            WHEN model LIKE 'anthropic:%claude-sonnet%' THEN 15.0
            WHEN model LIKE 'anthropic:%claude-haiku%'  THEN 5.0
            WHEN model LIKE 'openai:gpt-5.5%'      THEN 30.0
            WHEN model LIKE 'openai:gpt-5.4-mini%' THEN 4.5
            WHEN model LIKE 'openai:gpt-5.4-nano%' THEN 1.25
            WHEN model LIKE 'openai:gpt-5.4%'      THEN 15.0
            WHEN model LIKE 'openai:gpt-5.2%'      THEN 7.0
            WHEN model LIKE 'openai:gpt-5.1%'      THEN 5.0
            WHEN model LIKE 'openai:gpt-5-mini%'   THEN 2.0
            WHEN model LIKE 'openai:gpt-5-nano%'   THEN 0.4
            WHEN model LIKE 'openai:gpt-5%'        THEN 10.0
            WHEN model LIKE 'openai:gpt-4o-mini%'  THEN 0.6
            WHEN model LIKE 'openai:gpt-4o%'       THEN 10.0
            WHEN model LIKE 'openai:gpt-4.1-nano%' THEN 0.4
            WHEN model LIKE 'openai:gpt-4.1-mini%' THEN 1.6
            WHEN model LIKE 'openai:gpt-4.1%'      THEN 8.0
            WHEN model LIKE 'openai:o3-mini%'      THEN 4.4
            WHEN model LIKE 'openai:o3%'           THEN 8.0
            ELSE NULL
        END AS out_rate
    FROM run
    WHERE tokens_input IS NOT NULL
      AND tokens_output IS NOT NULL
)
UPDATE run r
SET cost_usd = ROUND(
        (rates.tokens_input::numeric / 1000000.0) * rates.in_rate
      + (rates.tokens_output::numeric / 1000000.0) * rates.out_rate,
        6)
FROM rates
WHERE r.id = rates.id
  AND rates.in_rate IS NOT NULL
  AND rates.out_rate IS NOT NULL;
