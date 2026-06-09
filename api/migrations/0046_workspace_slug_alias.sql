-- Old workspace slugs kept alive as redirects after a rename. Renaming a
-- workspace re-derives its slug from the new name; the prior slug lands here
-- so existing links and bookmarks still resolve. The [workspace] layout
-- redirects an alias hit to the workspace's current slug, preserving the
-- rest of the path.
--
-- old_slug is the primary key, so a given slug aliases at most one workspace
-- (and can't collide with a live slug check on rename). ON DELETE CASCADE
-- drops a workspace's aliases when the workspace itself is deleted.
CREATE TABLE IF NOT EXISTS workspace_slug_alias (
    old_slug     TEXT      PRIMARY KEY,
    workspace_id UUID      NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_slug_alias_workspace_id_idx
    ON workspace_slug_alias (workspace_id);
