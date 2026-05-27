-- Immutable, append-only audit log (US-0.4-01).
--
-- Records actor/when/source/target for the events we can't already
-- derive from existing tables. The audit-timeline UI UNIONs this
-- table with derived projections of run / improvement / automation /
-- workspace_trigger / workspace_composio_connection — so we don't
-- have to dual-write every v0.3 event into this table. New event
-- types that DON'T live in another table (RBAC changes, policy
-- overrides, secret rotations, member changes, connection
-- authorizations, repo connects) write rows here.
--
-- Append-only is enforced by convention + the absence of an UPDATE
-- path in the writer. Corrections (e.g., wrong actor recorded) are
-- represented as NEW rows with kind='correction' and a non-null
-- references_event_id pointing at the original — the original row
-- never disappears.
--
-- Per the v0.4-01 AC, `source` is the broad bucket the audit UI
-- filters by; `kind` is the specific event the row describes. The
-- CHECK constraint pins the source vocabulary so a typo at write
-- time gets rejected instead of silently fragmenting the filter
-- counts.

CREATE TABLE IF NOT EXISTS audit_event (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id         UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    -- NULL when the event was emitted by the system itself (e.g., a
    -- cron-fired automation, a token-refresh background task).
    actor_user_id        TEXT        REFERENCES "user"(id) ON DELETE SET NULL,
    at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source               TEXT        NOT NULL
        CHECK (source IN (
            'chat',
            'pr',
            'hitl_response',
            'dashboard_event',
            'correction',
            'human_action',
            'policy_change',
            'system'
        )),
    -- Specific event identifier, e.g. 'connection.authorized',
    -- 'automation.updated', 'secret.rotated'. Free-form by design —
    -- the audit UI groups + labels via a TS lookup table, not a
    -- second CHECK constraint that we'd have to migrate every time
    -- a new event type ships.
    kind                 TEXT        NOT NULL,
    target_type          TEXT        NOT NULL,
    -- Either an agent name, a uuid (automation/connection/trigger),
    -- or NULL for workspace-scoped events. Kept as text so any of
    -- those shapes fits without a discriminated column.
    target_id            TEXT,
    -- Denormalized for the per-agent timeline's WHERE clause — saves
    -- a JOIN against improvement/automation/etc just to filter the
    -- audit feed to one agent. NULL for workspace-scoped events.
    agent_name           TEXT,
    -- Event-specific structured payload. The audit UI renders a
    -- human summary from (kind, payload); the raw payload stays
    -- available via "View JSON" on each row.
    payload              JSONB       NOT NULL DEFAULT '{}'::JSONB,
    -- Non-null on kind='correction' rows; points at the event being
    -- corrected. The original row stays exactly where it was.
    references_event_id  UUID        REFERENCES audit_event(id) ON DELETE RESTRICT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Common access patterns the audit UI hits:
--   * workspace timeline (newest first)
--   * per-agent timeline (newest first)
--   * filter by source within a workspace
CREATE INDEX IF NOT EXISTS audit_event_workspace_at_idx
    ON audit_event(workspace_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_event_workspace_agent_at_idx
    ON audit_event(workspace_id, agent_name, at DESC)
    WHERE agent_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_event_workspace_source_at_idx
    ON audit_event(workspace_id, source, at DESC);
