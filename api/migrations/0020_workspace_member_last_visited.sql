-- Track when each member last opened a workspace so signing in lands
-- the user on the workspace they were just in, not the first one
-- they ever created. Nullable so existing rows don't need a backfill
-- — `NULLS LAST` in the redirect query handles the "never visited
-- since this migration" case.
--
-- We update this column on every request to a [workspace]/* route
-- in the web layer (Next.js workspace layout). Fire-and-forget; if
-- the update fails the request still serves, the row just stays
-- stale until the next visit.

ALTER TABLE workspace_member
    ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMPTZ;
