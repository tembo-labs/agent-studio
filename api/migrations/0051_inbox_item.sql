-- Tasks Inbox (TASIP-004): a single, source-agnostic queue of actionable items
-- that BOTH humans and agents work. An item is produced by an agent (or a
-- source adapter like LinkedIn, or a human) carrying the agent's best-guess
-- `proposed_action`; a human reviews/edits/submits it as `final_action`. The
-- diff between the two IS the learning signal — there's no separate signal
-- table; a scheduled batch (see the scheduler's learning pass) later collapses
-- a run of unconsumed signals into ONE improvement -> CAP PR and stamps the
-- consumed rows. Agents act on the queue as peers via the tembo-agent-studio
-- MCP tools (list/get/produce/claim/complete), so this is not a run-lifecycle
-- change — the `run` table's fixed status set is untouched.

CREATE TABLE IF NOT EXISTS inbox_item (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    -- Where the item came from: 'agent', 'manual', 'linkedin', ... Validated in
    -- TS (like audit_event.kind / the mcp-providers catalog), NOT a CHECK, so a
    -- new source ships without a migration.
    source              TEXT        NOT NULL,
    -- The producer's own id for the item (e.g. a LinkedIn invitation urn). Used
    -- to make pushes idempotent via the partial unique index below. NULL when
    -- the source has no stable external id.
    external_ref        TEXT,
    -- 'connection_request' | 'message_reply' | 'notification' | 'post_engagement'
    -- | free-form. Also TS-validated, not a CHECK.
    item_type           TEXT        NOT NULL,
    -- Short label for the triage list row.
    title               TEXT        NOT NULL,
    -- The raw payload to review (the message, the request, the post). JSONB so
    -- any source pushes arbitrary shapes with no migration (cf. audit_event.payload).
    context             JSONB       NOT NULL DEFAULT '{}'::JSONB,
    -- The agent's best guess at what to do: { text, fields? }. NULL until set.
    proposed_action     JSONB,
    -- What the human actually submitted (same shape). The pair (proposed, final)
    -- IS the learning signal — app code diffs them; nothing is stored separately.
    final_action        JSONB,
    status              TEXT        NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'claimed', 'awaiting_human', 'done', 'dismissed')),
    -- Who's working it. assignee_id is a user.id OR an agent name — kept TEXT so
    -- both shapes fit one column (mirrors audit_event.target_id).
    assignee_kind       TEXT        CHECK (assignee_kind IN ('human', 'agent')),
    assignee_id         TEXT,
    -- The agent run that produced this item (resolves the agent name for the
    -- learning batch). NULL for human/source-pushed items.
    produced_by_run_id  UUID        REFERENCES run(id) ON DELETE SET NULL,
    -- The BATCH improvement that consumed this row's signal (set by the learning
    -- pass, not at submit time). NULL until learned.
    improvement_id      UUID        REFERENCES improvement(id) ON DELETE SET NULL,
    -- NULL = a recorded-but-not-yet-learned signal awaiting the next cycle.
    signal_consumed_at  TIMESTAMPTZ,
    -- NULL when produced by an agent/source/system rather than a person.
    created_by          TEXT        REFERENCES "user"(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ
);

-- Triage list: a workspace's items, filtered by status, newest first.
CREATE INDEX IF NOT EXISTS inbox_item_workspace_status_created_idx
    ON inbox_item(workspace_id, status, created_at DESC);

-- Idempotent producer pushes: at most one row per (source, external_ref) in a
-- workspace. Partial so multiple external_ref-less items coexist.
CREATE UNIQUE INDEX IF NOT EXISTS inbox_item_external_ref_idx
    ON inbox_item(workspace_id, source, external_ref)
    WHERE external_ref IS NOT NULL;

-- The learning pass's gather query: unconsumed signals (submitted but not yet
-- batched into an improvement) for a workspace.
CREATE INDEX IF NOT EXISTS inbox_item_unconsumed_signal_idx
    ON inbox_item(workspace_id)
    WHERE final_action IS NOT NULL AND signal_consumed_at IS NULL;
