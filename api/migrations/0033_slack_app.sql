-- TAS-managed Slack apps. Each row is one Slack app TAS owns for a
-- workspace — e.g. a "sales" bot and a "support" bot, each with its own
-- identity, install, request URLs, and a label-scoped subset of agents
-- it can launch from Slack. The inbound request URL TAS hands to Slack
-- is keyed by this row's id (/api/slack/<id>/...), so routing resolves
-- by primary key.
--
-- Credentials — the Slack request-signing secret, the OAuth client
-- secret, and the bot token — are AES-256-GCM encrypted with the same
-- nonce||ciphertext||tag blob layout as workspace_secret (see
-- web/src/lib/crypto.ts). Non-secret identifiers stay plaintext.

CREATE TABLE IF NOT EXISTS workspace_slack_app (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name                  TEXT        NOT NULL,
    -- Slack's own app id (Axxxxxxxx); informational + used in the manifest.
    slack_app_id          TEXT,
    -- Verifies inbound slash-command / event / interactivity requests.
    signing_secret        BYTEA,
    -- OAuth client credentials for the "Add to Slack" install flow.
    client_id             TEXT,
    client_secret         BYTEA,
    -- Bot token (xoxb-…), populated by the OAuth install; null until installed.
    bot_token             BYTEA,
    team_id               TEXT,
    bot_user_id           TEXT,
    -- Run-as fallback: when an inbound Slack user can't be mapped to a
    -- workspace member by email, the dispatched run acts as this member.
    default_owner_user_id TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    -- Agent scope: this app may launch agents carrying any of these labels.
    agent_labels          TEXT[]      NOT NULL DEFAULT '{}',
    status                TEXT        NOT NULL DEFAULT 'configuring'
        CHECK (status IN ('configuring', 'installed', 'disabled')),
    created_by            TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One app name per workspace (case-insensitive) — keeps the settings list
-- and the per-team bot identities unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS workspace_slack_app_name_uniq
    ON workspace_slack_app (workspace_id, lower(name));
