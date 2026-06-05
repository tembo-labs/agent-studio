-- External webhook triggers. A workspace_webhook row binds an inbound HTTP
-- endpoint to an agent: an outside system (Clay first) POSTs JSON to
-- /api/hooks/webhook/<id> with an `Authorization: Bearer <token>` header, and
-- TAS queues a run of `agent_name` (acting as `owner_user_id`) with the request
-- body passed to the agent as its input. Fire-and-forget — the run's output
-- lands in /runs; any write-back is done by the agent's own tools.
--
-- The row `id` is the PUBLIC selector in the URL (not a secret). The bearer
-- `token` is the secret: random, encrypted at rest with the shared AES-256-GCM
-- master key (nonce || ciphertext || tag), shown to the user once on creation;
-- token_last4 is plaintext only for the masked preview. Per-(workspace, agent),
-- mirroring the per-agent Composio workspace_trigger model + the owner/acting-
-- user pattern used by automations and triggers.

CREATE TABLE IF NOT EXISTS workspace_webhook (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    agent_name       TEXT        NOT NULL,
    owner_user_id    TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    name             TEXT        NOT NULL,
    token_ciphertext BYTEA       NOT NULL,
    token_last4      TEXT        NOT NULL,
    enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
    last_fired_at    TIMESTAMPTZ,
    last_fire_error  TEXT,
    created_by       TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_webhook_ws_agent_idx
    ON workspace_webhook (workspace_id, agent_name);
