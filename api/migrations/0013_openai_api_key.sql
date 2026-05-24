-- Allow openai_api_key alongside the existing workspace secret kinds.
-- Agents can now declare `model: "openai:gpt-4o-mini"` (or any other
-- OpenAI model) and the runtime resolves the workspace's stored
-- OpenAI key the same way it resolves Anthropic.

ALTER TABLE workspace_secret DROP CONSTRAINT IF EXISTS workspace_secret_kind_check;
ALTER TABLE workspace_secret
    ADD CONSTRAINT workspace_secret_kind_check
    CHECK (kind IN ('tembo_api_key', 'github_pat', 'anthropic_api_key', 'openai_api_key'));
