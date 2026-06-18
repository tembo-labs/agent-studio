-- Deep link for an inbox item back to its source object (Linear issue, Pylon
-- ticket, Attio record, Dialed task, LinkedIn thread, …) so a human can jump
-- straight from the item to the thing it's about. Nullable — most sources have
-- a URL, some don't.
ALTER TABLE inbox_item ADD COLUMN IF NOT EXISTS external_url TEXT;
