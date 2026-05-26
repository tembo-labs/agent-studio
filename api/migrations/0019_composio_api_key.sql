-- Allow `composio_api_key` as a workspace_secret kind. Each workspace
-- supplies its own Composio API key in Settings rather than sharing a
-- single TAS-instance-wide key — mirrors how Tembo/Anthropic/OpenAI
-- keys are scoped (and lets different teams in one TAS deploy keep
-- their Composio billing/usage separate).

ALTER TABLE workspace_secret DROP CONSTRAINT IF EXISTS workspace_secret_kind_check;
ALTER TABLE workspace_secret
    ADD CONSTRAINT workspace_secret_kind_check
    CHECK (kind IN (
        'tembo_api_key',
        'github_pat',
        'anthropic_api_key',
        'openai_api_key',
        'composio_api_key'
    ));
