-- "Wait" / snooze: hide an item from the active inbox until a chosen time, then
-- let it reappear automatically. No cron — the active-inbox queries simply
-- filter out rows whose snoozed_until is still in the future; once now passes it
-- the (still-unresolved) item shows up again. NULL = not snoozed.
ALTER TABLE inbox_item
    ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
