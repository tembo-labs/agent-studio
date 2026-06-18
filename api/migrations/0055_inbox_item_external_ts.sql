-- Producer-supplied "freshness" marker for an inbox item: the source's latest
-- activity time (e.g. a LinkedIn conversation's last message, epoch millis).
--
-- Drives reopen-on-new-activity: the idempotent producer upsert (createInboxItem)
-- dedupes by (workspace, source, external_ref), but when the incoming external_ts
-- is NEWER than the stored one it REOPENS + refreshes the item (status →
-- awaiting_human, clears the prior resolution) so a reply to an archived/handled
-- thread comes back into the inbox. NULL = producer didn't supply one (plain
-- dedupe, no reopen).
ALTER TABLE inbox_item
    ADD COLUMN IF NOT EXISTS external_ts BIGINT;
