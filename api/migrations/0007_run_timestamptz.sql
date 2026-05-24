-- Migration 0006 created the run timestamp columns as TIMESTAMP (no
-- tz), but the Rust API deserializes them into chrono::DateTime<Utc>
-- (which expects TIMESTAMPTZ). Convert the columns so the GET /runs/:id
-- handler can decode rows. Postgres interprets the existing values as
-- the session time zone (UTC inside the api container) when widening.

ALTER TABLE run ALTER COLUMN created_at  SET DATA TYPE TIMESTAMPTZ;
ALTER TABLE run ALTER COLUMN started_at  SET DATA TYPE TIMESTAMPTZ;
ALTER TABLE run ALTER COLUMN completed_at SET DATA TYPE TIMESTAMPTZ;
