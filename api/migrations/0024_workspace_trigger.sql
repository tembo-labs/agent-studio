-- Event-driven runs. A workspace_trigger row binds a Composio trigger
-- instance ("new email arrived", "new Slack message in #ops") to an
-- agent in this workspace. Composio owns the per-provider subscription
-- complexity — we just register the trigger via their API, cache its
-- id here, and stand up a single signed webhook endpoint to receive
-- the events.
--
-- The (workspace, user) pair on each row mirrors the model used by
-- workspace_composio_connection + automation.owner_user_id: each
-- trigger fires runs as a specific workspace member so the runner can
-- resolve that user's connections. composio_trigger_id is what the
-- webhook payload carries back to us — it's how we route an inbound
-- event to (which workspace, which agent, which owner).
--
-- connection_id pins the trigger to a specific named connection slot
-- (so a "personal Gmail" trigger and a "work Gmail" trigger on the
-- same agent are unambiguous). ON DELETE RESTRICT so disconnecting a
-- credential surfaces the dangling triggers in the UI rather than
-- silently breaking them.

CREATE TABLE IF NOT EXISTS workspace_trigger (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id         UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    user_id              TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    agent_name           TEXT        NOT NULL,
    composio_trigger_id  TEXT        NOT NULL UNIQUE,
    toolkit_slug         TEXT        NOT NULL,
    trigger_type         TEXT        NOT NULL,
    connection_id        UUID        NOT NULL REFERENCES workspace_composio_connection(id) ON DELETE RESTRICT,
    trigger_config       JSONB       NOT NULL DEFAULT '{}'::JSONB,
    enabled              BOOLEAN     NOT NULL DEFAULT TRUE,
    last_fired_at        TIMESTAMPTZ,
    last_fire_error      TEXT,
    created_by           TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_trigger_workspace_agent_idx
    ON workspace_trigger(workspace_id, agent_name);
CREATE INDEX IF NOT EXISTS workspace_trigger_workspace_user_idx
    ON workspace_trigger(workspace_id, user_id);
