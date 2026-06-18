-- Allow `scaledown_api_key` as a workspace_secret kind. ScaleDown
-- (scaledown.ai) is an optional prompt-compression layer configured under
-- Settings → LLM providers, alongside the Anthropic/OpenAI keys. The CHECK
-- constraint is re-stated in full (drop + re-add) — same pattern as the
-- earlier provider-key migrations (0013, 0019, 0028).
ALTER TABLE workspace_secret DROP CONSTRAINT IF EXISTS workspace_secret_kind_check;
ALTER TABLE workspace_secret
    ADD CONSTRAINT workspace_secret_kind_check
    CHECK (kind IN (
        'tembo_api_key',
        'github_pat',
        'anthropic_api_key',
        'openai_api_key',
        'scaledown_api_key',
        'composio_api_key',
        'composio_webhook_secret',
        'attio_oauth_client_id',
        'attio_oauth_client_secret'
    ));
