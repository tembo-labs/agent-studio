-- Cache the estimated USD cost of each run on the row at mark-
-- succeeded time so the runs-list page (and any future cost
-- reporting) doesn't have to map model+tokens → cost on every
-- render. NUMERIC(12, 6) gives us sub-cent precision (down to
-- 0.000001 USD) which is more than enough for current pricing
-- (sub-cent runs are common on small inputs).
--
-- Nullable for pre-existing rows + frameworks that don't report
-- token counts. The web-side estimateRunCost still owns the
-- pattern → rate table; the Rust runner mirrors it (see
-- api/src/pricing.rs).

ALTER TABLE run
    ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12, 6);
