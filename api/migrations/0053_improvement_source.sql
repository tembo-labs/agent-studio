-- Mark where an improvement came from, so the UI can distinguish a change the
-- continuous-learning loop produced from a hand-submitted one.
--
--   'chat'     — submitted by a person (run "Improve the Agent", chat-to-edit,
--                chat-to-create, or the REST/MCP request_agent_change).
--   'learning' — opened by the scheduler's batched Tasks Inbox learning pass
--                (requestAgentChangeSystem), folding a cycle's corrections into
--                one PR.
--
-- Free-form by design (validated in TS, like audit_event.kind) so a new source
-- ships without a migration. Defaults to 'chat' so existing rows + legacy
-- callers keep their meaning.
ALTER TABLE improvement
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'chat';
