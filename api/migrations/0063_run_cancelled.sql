-- Add a 'cancelled' terminal run status for user-killed runs, distinct from
-- 'failed' (a real error). Set by the kill-run path; the runner SIGKILLs the
-- subprocess and writes this status. Keeps killed runs out of the failure
-- dashboards/badges.
ALTER TABLE run DROP CONSTRAINT IF EXISTS run_status_check;
ALTER TABLE run
    ADD CONSTRAINT run_status_check
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled'));
