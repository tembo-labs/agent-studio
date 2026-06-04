-- Where to post a run's result back in Slack. The web dispatcher inserts
-- one row when a run is launched from a Slack app (slash command, picker,
-- mention or DM); the api runner reads it on run completion, decrypts the
-- app's bot token, and posts the output into the originating thread.
--
-- Keyed by run_id (1:1 — a run has at most one Slack origin). channel +
-- thread_ts locate the reply; thread_ts is null for a top-level post
-- (e.g. a DM where we reply un-threaded). delivered_at marks the post as
-- done so a re-run of the completion path is idempotent.

CREATE TABLE IF NOT EXISTS slack_delivery (
    run_id        UUID        PRIMARY KEY REFERENCES run(id) ON DELETE CASCADE,
    slack_app_id  UUID        NOT NULL REFERENCES workspace_slack_app(id) ON DELETE CASCADE,
    channel       TEXT        NOT NULL,
    thread_ts     TEXT,
    delivered_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
