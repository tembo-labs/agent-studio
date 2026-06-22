-- Inboxes are PRIVATE per user. Before this, inbox_item was only scoped by
-- workspace_id, so every member saw every member's items. Add an explicit
-- owner: the user the producing run acted as (or the human who filed it).
-- Reads (list/count/get) and mutations filter on it; items with no resolvable
-- owner stay NULL and are visible to no one (safer than leaking).
ALTER TABLE inbox_item
    ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;

-- Backfill agent-produced items from the producing run's acting user
-- (run.created_by is the acting/owner user the run executed as).
UPDATE inbox_item i
   SET owner_user_id = r.created_by
  FROM run r
 WHERE i.produced_by_run_id = r.id
   AND i.owner_user_id IS NULL;

-- Backfill human-filed items (created_by set when a person filed it directly).
UPDATE inbox_item
   SET owner_user_id = created_by
 WHERE owner_user_id IS NULL
   AND created_by IS NOT NULL;

-- The hot path: "my active items in this workspace, newest first."
CREATE INDEX IF NOT EXISTS inbox_item_owner_idx
    ON inbox_item (workspace_id, owner_user_id, status, created_at DESC);
