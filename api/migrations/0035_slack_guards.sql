-- Hardening for Slack dispatch: replay dedupe + per-user rate limiting.

-- Slack retries an event delivery if our ack is slow; each retry carries
-- the same envelope event_id. Record the ids we've handled so a retry is a
-- no-op instead of a duplicate run.
CREATE TABLE IF NOT EXISTS slack_event_seen (
    slack_app_id UUID        NOT NULL REFERENCES workspace_slack_app(id) ON DELETE CASCADE,
    event_id     TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (slack_app_id, event_id)
);

-- slack_delivery already has one row per dispatched run, so tag it with the
-- triggering Slack user (rather than add a table) and we can rate-limit by
-- counting recent rows for an (app, user) pair.
ALTER TABLE slack_delivery ADD COLUMN IF NOT EXISTS slack_user_id TEXT;
CREATE INDEX IF NOT EXISTS slack_delivery_rate_idx
    ON slack_delivery (slack_app_id, slack_user_id, created_at);
