-- Two small CHECK relaxations that the event-trigger feature needs:
--
--   1. workspace_secret.kind = 'composio_webhook_secret' so each
--      workspace can store its Composio webhook signing secret next
--      to the API key. Encrypted in the same column as the other
--      keys; only the kind enum needs widening.
--
--   2. run.trigger = 'event' so the webhook-fired runs land on the
--      same row shape as manual + scheduled runs. The /internal/runs
--      handler validates this same string up front, so widening the
--      CHECK without widening the match would silently drop events
--      with a 400.

ALTER TABLE workspace_secret DROP CONSTRAINT IF EXISTS workspace_secret_kind_check;
ALTER TABLE workspace_secret
    ADD CONSTRAINT workspace_secret_kind_check
    CHECK (kind IN (
        'tembo_api_key',
        'github_pat',
        'anthropic_api_key',
        'openai_api_key',
        'composio_api_key',
        'composio_webhook_secret'
    ));

ALTER TABLE run DROP CONSTRAINT IF EXISTS run_trigger_check;
ALTER TABLE run
    ADD CONSTRAINT run_trigger_check
    CHECK (trigger IN ('manual', 'schedule', 'event'));
