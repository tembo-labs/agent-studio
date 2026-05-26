-- Per-user + named connections. Two changes that have to land
-- together because they share the new unique key.
--
-- Before: one Composio connection per (workspace, toolkit). Any
-- workspace member running an agent shared that connection. This
-- mixes audit ("who sent that Slack message?") and blocks the
-- "I want two Gmail accounts" case dead.
--
-- After: a connection is owned by a specific user and has a name
-- (slug-ish, "default" / "work" / "personal"). The new unique key
-- is (workspace_id, user_id, toolkit_slug, name). The agent spec
-- can reference a specific named connection; otherwise resolves
-- to that user's "default" of the toolkit.
--
-- Backfill: existing rows get user_id = created_by (whoever first
-- clicked Connect now owns them) and name = 'default'. Other
-- workspace members who relied on those connections will need to
-- authorize their own — this is a deliberate v0.3 behavior shift
-- and the release notes call it out.

ALTER TABLE workspace_composio_connection
    ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE;
ALTER TABLE workspace_composio_connection
    ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'default';

UPDATE workspace_composio_connection
   SET user_id = created_by
 WHERE user_id IS NULL;

ALTER TABLE workspace_composio_connection
    ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE workspace_composio_connection
    DROP CONSTRAINT IF EXISTS workspace_composio_connection_workspace_id_toolkit_slug_key;

ALTER TABLE workspace_composio_connection
    ADD CONSTRAINT workspace_composio_connection_workspace_user_toolkit_name_key
    UNIQUE (workspace_id, user_id, toolkit_slug, name);

CREATE INDEX IF NOT EXISTS workspace_composio_connection_workspace_user_idx
    ON workspace_composio_connection(workspace_id, user_id);
