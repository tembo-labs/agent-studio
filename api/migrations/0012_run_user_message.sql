-- Persist the user message that triggered each run. Lets us
-- distinguish "Run now" runs (empty user_message) from runs
-- created by the /chat composer (talk-to-agent turns), and render
-- the conversation thread on the agent's chat page.

ALTER TABLE run
    ADD COLUMN IF NOT EXISTS user_message TEXT NOT NULL DEFAULT '';
