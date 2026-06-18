-- Action menu for an inbox item: the set of things the producer (usually an
-- agent) thinks the human might want to do — rendered as buttons in the Inbox.
--
-- Each option is { id, label, kind: 'reply'|'oneclick', draft?, recommended?,
-- execute?: { provider, op, params } }. 'reply' carries an editable draft;
-- 'oneclick' is a one-tap action. `execute` (when present) is the descriptor a
-- synchronous executor uses to actually perform the action (e.g. LinkedIn
-- archive/send) — validated server-side against this stored value, never
-- trusted from the client. No `execute` (e.g. "Ignore") just resolves the item.
--
-- JSONB + app-validated shape (like context/proposed_action) so any source can
-- declare its own action set without a migration. NULL = no menu (the item
-- uses the plain free-text review form).
ALTER TABLE inbox_item
    ADD COLUMN IF NOT EXISTS options JSONB;
