-- Store a permalink to the Slack message that instigated a run, so the
-- runs UI can deep-link back to the conversation. Fetched once at dispatch
-- time via chat.getPermalink (the constructed-URL form needs the workspace
-- subdomain, which we don't hold). Null for slash-command runs (no message)
-- and for runs that predate this column.
ALTER TABLE slack_delivery ADD COLUMN IF NOT EXISTS permalink TEXT;
