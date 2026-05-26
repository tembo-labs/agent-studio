-- Scheduled runs need to act AS someone now that Composio
-- connections are per-user — without an owner the runner has no
-- user_id to look up connections under, and the run would fail
-- immediately for any agent that declares `connections:`.
--
-- Backfill: existing automations get owner_user_id = created_by.
-- That preserves the v0.2 behavior where the automation's
-- credentials implicitly came from "the workspace" (which in
-- practice was "whoever first authorized that toolkit"). The
-- automation form's new "Run as" picker lets owners change it
-- after the migration lands.

ALTER TABLE automation
    ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES "user"(id) ON DELETE RESTRICT;

UPDATE automation
   SET owner_user_id = created_by
 WHERE owner_user_id IS NULL;

ALTER TABLE automation
    ALTER COLUMN owner_user_id SET NOT NULL;
