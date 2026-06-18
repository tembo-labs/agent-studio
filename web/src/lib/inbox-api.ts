import "server-only";

import { db } from "@/lib/db";

// CRUD for the `inbox_item` table (Tasks Inbox / TASIP-004). A source-agnostic
// queue of actionable items that BOTH humans and agents work. An item carries
// the agent's `proposedAction` (its best guess); a human reviews/edits/submits
// it as `finalAction`. The (proposed, final) pair IS the learning signal — a
// scheduled batch (the scheduler's learning pass) later collapses unconsumed
// signals into one improvement and stamps the rows. Mirrors improvements-api.ts:
// same db.query style, same user-join projection, guarded UPDATEs for races.

export type InboxItemStatus =
  | "open"
  | "claimed"
  | "awaiting_human"
  | "done"
  | "dismissed";

export type InboxAssigneeKind = "human" | "agent";

// An action the agent proposes or the human finalizes. `text` is the free-form
// reply/decision; `fields` carries structured params for typed item types
// (e.g. { decision: "accept" }). Both optional so simple items need only text.
export interface InboxAction {
  text?: string;
  fields?: Record<string, unknown>;
}

export interface InboxItem {
  id: string;
  workspaceId: string;
  source: string;
  externalRef: string | null;
  itemType: string;
  title: string;
  context: Record<string, unknown>;
  proposedAction: InboxAction | null;
  finalAction: InboxAction | null;
  status: InboxItemStatus;
  assigneeKind: InboxAssigneeKind | null;
  assigneeId: string | null;
  producedByRunId: string | null;
  improvementId: string | null;
  signalConsumedAt: Date | null;
  // Null when produced by an agent/source/system rather than a person.
  createdBy: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

type Row = {
  id: string;
  workspace_id: string;
  source: string;
  external_ref: string | null;
  item_type: string;
  title: string;
  context: Record<string, unknown> | null;
  proposed_action: InboxAction | null;
  final_action: InboxAction | null;
  status: InboxItemStatus;
  assignee_kind: InboxAssigneeKind | null;
  assignee_id: string | null;
  produced_by_run_id: string | null;
  improvement_id: string | null;
  signal_consumed_at: Date | null;
  created_by: string | null;
  created_by_name: string | null;
  created_by_email: string | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
};

function rowToInboxItem(r: Row): InboxItem {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    source: r.source,
    externalRef: r.external_ref,
    itemType: r.item_type,
    title: r.title,
    context: r.context ?? {},
    proposedAction: r.proposed_action,
    finalAction: r.final_action,
    status: r.status,
    assigneeKind: r.assignee_kind,
    assigneeId: r.assignee_id,
    producedByRunId: r.produced_by_run_id,
    improvementId: r.improvement_id,
    signalConsumedAt: r.signal_consumed_at,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdByEmail: r.created_by_email,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    resolvedAt: r.resolved_at,
  };
}

// SELECT projection with a LEFT JOIN against "user" so a human-created row
// includes the submitter's name + email. LEFT JOIN keeps agent/source-produced
// rows (created_by IS NULL) visible.
const COLUMNS = `
  i.id, i.workspace_id, i.source, i.external_ref, i.item_type, i.title,
  i.context, i.proposed_action, i.final_action, i.status,
  i.assignee_kind, i.assignee_id, i.produced_by_run_id, i.improvement_id,
  i.signal_consumed_at, i.created_by,
  u.name AS created_by_name, u.email AS created_by_email,
  i.created_at, i.updated_at, i.resolved_at
`;
const FROM_JOIN = `FROM inbox_item i LEFT JOIN "user" u ON u.id = i.created_by`;

export interface CreateInboxItemInput {
  workspaceId: string;
  source: string;
  externalRef?: string | null;
  itemType: string;
  title: string;
  context?: Record<string, unknown>;
  proposedAction?: InboxAction | null;
  // 'open' = needs a proposal/claim; 'awaiting_human' = has a proposal, ready
  // for review. Caller decides (the produce action sets awaiting_human when it
  // ships a proposedAction).
  status?: InboxItemStatus;
  assigneeKind?: InboxAssigneeKind | null;
  assigneeId?: string | null;
  producedByRunId?: string | null;
  createdBy?: string | null;
}

/**
 * Insert an item, or — when `externalRef` is set and already present for this
 * (workspace, source) — return the existing row unchanged. The ON CONFLICT
 * arbiter is the partial unique index, so external_ref-less items never
 * collide. Makes producer pushes idempotent (a source re-pushing the same item
 * doesn't duplicate it).
 */
export async function createInboxItem(
  input: CreateInboxItemInput,
): Promise<InboxItem> {
  const res = await db.query<Row>(
    `WITH upserted AS (
       INSERT INTO inbox_item (
         workspace_id, source, external_ref, item_type, title, context,
         proposed_action, status, assignee_kind, assignee_id,
         produced_by_run_id, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12)
       ON CONFLICT (workspace_id, source, external_ref) WHERE external_ref IS NOT NULL
       DO UPDATE SET updated_at = NOW()
       RETURNING *
     )
     SELECT ${COLUMNS}
     FROM upserted i
     LEFT JOIN "user" u ON u.id = i.created_by`,
    [
      input.workspaceId,
      input.source,
      input.externalRef ?? null,
      input.itemType,
      input.title,
      JSON.stringify(input.context ?? {}),
      input.proposedAction ? JSON.stringify(input.proposedAction) : null,
      input.status ?? "open",
      input.assigneeKind ?? null,
      input.assigneeId ?? null,
      input.producedByRunId ?? null,
      input.createdBy ?? null,
    ],
  );
  return rowToInboxItem(res.rows[0]);
}

export type InboxSortKey =
  | "created_at"
  | "updated_at"
  | "title"
  | "item_type"
  | "source"
  | "status";
export type SortDir = "asc" | "desc";

// Allowlist sort keys → real columns so a caller (incl. an MCP client) can't
// inject an ORDER BY.
const SORT_COLUMNS: Record<InboxSortKey, string> = {
  created_at: "i.created_at",
  updated_at: "i.updated_at",
  title: "i.title",
  item_type: "i.item_type",
  source: "i.source",
  status: "i.status",
};

export interface ListInboxFilters {
  statuses?: InboxItemStatus[];
  source?: string;
  itemType?: string;
  assigneeId?: string;
  /** Free-text match against title + the raw context payload. */
  search?: string;
  sort?: InboxSortKey;
  dir?: SortDir;
}

export async function listInboxItems(
  workspaceId: string,
  filters: ListInboxFilters = {},
  limit = 100,
): Promise<InboxItem[]> {
  const params: unknown[] = [workspaceId];
  const where: string[] = [`i.workspace_id = $1`];
  if (filters.statuses && filters.statuses.length > 0) {
    params.push(filters.statuses);
    where.push(`i.status = ANY($${params.length}::text[])`);
  }
  if (filters.source) {
    params.push(filters.source);
    where.push(`i.source = $${params.length}`);
  }
  if (filters.itemType) {
    params.push(filters.itemType);
    where.push(`i.item_type = $${params.length}`);
  }
  if (filters.assigneeId) {
    params.push(filters.assigneeId);
    where.push(`i.assignee_id = $${params.length}`);
  }
  if (filters.search && filters.search.trim()) {
    params.push(`%${filters.search.trim()}%`);
    where.push(`(i.title ILIKE $${params.length} OR i.context::text ILIKE $${params.length})`);
  }
  const sortCol = SORT_COLUMNS[filters.sort ?? "created_at"];
  const dir = filters.dir === "asc" ? "ASC" : "DESC";
  params.push(limit);
  const res = await db.query<Row>(
    `SELECT ${COLUMNS}
     ${FROM_JOIN}
     WHERE ${where.join(" AND ")}
     ORDER BY ${sortCol} ${dir}, i.id DESC
     LIMIT $${params.length}`,
    params,
  );
  return res.rows.map(rowToInboxItem);
}

/** Count of active (unresolved) items — the sidebar badge. */
export async function countActiveInboxItems(
  workspaceId: string,
): Promise<number> {
  const res = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM inbox_item
      WHERE workspace_id = $1 AND status IN ('open', 'claimed', 'awaiting_human')`,
    [workspaceId],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function getInboxItem(
  id: string,
  workspaceId: string,
): Promise<InboxItem | null> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS} ${FROM_JOIN} WHERE i.id = $1 AND i.workspace_id = $2`,
    [id, workspaceId],
  );
  return res.rows[0] ? rowToInboxItem(res.rows[0]) : null;
}

/**
 * Claim an open item for a human or agent. Guarded `WHERE status = 'open'` so
 * two concurrent claimers race safely — the loser gets `false`. Mirrors
 * dismissPendingCreate's guarded-update pattern.
 */
export async function claimInboxItem(
  id: string,
  workspaceId: string,
  assigneeKind: InboxAssigneeKind,
  assigneeId: string,
): Promise<boolean> {
  const res = await db.query(
    `UPDATE inbox_item
        SET status = 'claimed', assignee_kind = $3, assignee_id = $4, updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2 AND status = 'open'`,
    [id, workspaceId, assigneeKind, assigneeId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Set the agent's proposed action and move the item to awaiting_human review.
 *  Allowed from open/claimed (not from a terminal state). */
export async function setProposedAction(
  id: string,
  workspaceId: string,
  proposedAction: InboxAction,
): Promise<boolean> {
  const res = await db.query(
    `UPDATE inbox_item
        SET proposed_action = $3::jsonb, status = 'awaiting_human', updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2 AND status IN ('open', 'claimed')`,
    [id, workspaceId, JSON.stringify(proposedAction)],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Record the human's (or an autonomous agent's) final action and resolve the
 *  item. The (proposed, final) pair becomes an unconsumed learning signal. */
export async function completeInboxItem(
  id: string,
  workspaceId: string,
  finalAction: InboxAction,
): Promise<boolean> {
  const res = await db.query(
    `UPDATE inbox_item
        SET final_action = $3::jsonb, status = 'done',
            resolved_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2
        AND status NOT IN ('done', 'dismissed')`,
    [id, workspaceId, JSON.stringify(finalAction)],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Drop an item without acting on it. No learning signal (no final_action). */
export async function dismissInboxItem(
  id: string,
  workspaceId: string,
): Promise<boolean> {
  const res = await db.query(
    `UPDATE inbox_item
        SET status = 'dismissed', resolved_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2
        AND status NOT IN ('done', 'dismissed')`,
    [id, workspaceId],
  );
  return (res.rowCount ?? 0) > 0;
}

// ── Learning-loop signal gathering (scheduler) ────────────────────────

/**
 * Unconsumed learning signals an agent produced: resolved items (final_action
 * set) that the batched learning pass hasn't folded into an improvement yet.
 * Joins through produced_by_run_id to attribute the item to the agent that
 * created it. The web layer reads the `run` table directly here (same as
 * audit-db's run projection).
 */
export async function listUnconsumedSignalsForAgent(
  workspaceId: string,
  agentName: string,
  limit = 100,
): Promise<InboxItem[]> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS}
       FROM inbox_item i
       JOIN run r ON r.id = i.produced_by_run_id
       LEFT JOIN "user" u ON u.id = i.created_by
      WHERE i.workspace_id = $1
        AND r.agent_name = $2
        AND i.final_action IS NOT NULL
        AND i.signal_consumed_at IS NULL
      ORDER BY i.resolved_at ASC
      LIMIT $3`,
    [workspaceId, agentName, limit],
  );
  return res.rows.map(rowToInboxItem);
}

/** Stamp a batch of signals consumed by one improvement (improvementId may be
 *  null when the batch had nothing worth changing — still marks them seen). */
export async function markSignalsConsumed(
  ids: string[],
  improvementId: string | null,
): Promise<void> {
  if (ids.length === 0) return;
  await db.query(
    `UPDATE inbox_item
        SET signal_consumed_at = NOW(), improvement_id = $2, updated_at = NOW()
      WHERE id = ANY($1::uuid[])`,
    [ids, improvementId],
  );
}

// ── Learning view (per-agent activity + results) ──────────────────────

// SQL for "the human's final action differs from the agent's proposal" — the
// same notion as the scheduler's actionDiffers (trimmed text, or fields differ).
const SIGNAL_DIFFERS = `(
  COALESCE(btrim(i.proposed_action->>'text'), '') IS DISTINCT FROM COALESCE(btrim(i.final_action->>'text'), '')
  OR (i.proposed_action->'fields') IS DISTINCT FROM (i.final_action->'fields')
)`;

export interface AgentSignalStats {
  /** Resolved items this agent produced (a learning signal each). */
  resolved: number;
  /** Resolved where the human kept the agent's proposal as-is. */
  accepted: number;
  /** Resolved where the human changed it (a correction). */
  corrected: number;
  /** Resolved but not yet folded into a learning batch. */
  pending: number;
  /** Of pending, how many are corrections (i.e. will drive the next PR). */
  pendingCorrected: number;
}

export async function getAgentSignalStats(
  workspaceId: string,
  agentName: string,
): Promise<AgentSignalStats> {
  const res = await db.query<{
    resolved: string;
    accepted: string;
    corrected: string;
    pending: string;
    pending_corrected: string;
  }>(
    `SELECT
       count(*) FILTER (WHERE i.final_action IS NOT NULL) AS resolved,
       count(*) FILTER (WHERE i.final_action IS NOT NULL AND NOT ${SIGNAL_DIFFERS}) AS accepted,
       count(*) FILTER (WHERE i.final_action IS NOT NULL AND ${SIGNAL_DIFFERS}) AS corrected,
       count(*) FILTER (WHERE i.final_action IS NOT NULL AND i.signal_consumed_at IS NULL) AS pending,
       count(*) FILTER (WHERE i.final_action IS NOT NULL AND i.signal_consumed_at IS NULL AND ${SIGNAL_DIFFERS}) AS pending_corrected
     FROM inbox_item i
     JOIN run r ON r.id = i.produced_by_run_id
     WHERE i.workspace_id = $1 AND r.agent_name = $2`,
    [workspaceId, agentName],
  );
  const row = res.rows[0];
  return {
    resolved: Number(row?.resolved ?? 0),
    accepted: Number(row?.accepted ?? 0),
    corrected: Number(row?.corrected ?? 0),
    pending: Number(row?.pending ?? 0),
    pendingCorrected: Number(row?.pending_corrected ?? 0),
  };
}

export interface AgentLearningBatch {
  improvementId: string;
  status: string;
  prUrl: string | null;
  prNumber: number | null;
  commitUrl: string | null;
  temboTaskHtmlUrl: string | null;
  signalCount: number;
  correctedCount: number;
  createdAt: Date;
}

/** Past learning batches for an agent: each improvement the learning pass
 *  opened, with how many signals (and corrections) it folded in + its PR link. */
export async function listAgentLearningBatches(
  workspaceId: string,
  agentName: string,
  limit = 50,
): Promise<AgentLearningBatch[]> {
  const res = await db.query<{
    improvement_id: string;
    status: string;
    pr_url: string | null;
    pr_number: number | null;
    commit_url: string | null;
    tembo_task_html_url: string | null;
    signal_count: string;
    corrected_count: string;
    created_at: Date;
  }>(
    `SELECT im.id AS improvement_id, im.status, im.pr_url, im.pr_number,
            im.commit_url, im.tembo_task_html_url, im.created_at,
            count(i.id) AS signal_count,
            count(i.id) FILTER (WHERE ${SIGNAL_DIFFERS}) AS corrected_count
       FROM improvement im
       JOIN inbox_item i ON i.improvement_id = im.id
      WHERE im.workspace_id = $1 AND im.agent_name = $2
      GROUP BY im.id
      ORDER BY im.created_at DESC
      LIMIT $3`,
    [workspaceId, agentName, limit],
  );
  return res.rows.map((r) => ({
    improvementId: r.improvement_id,
    status: r.status,
    prUrl: r.pr_url,
    prNumber: r.pr_number,
    commitUrl: r.commit_url,
    temboTaskHtmlUrl: r.tembo_task_html_url,
    signalCount: Number(r.signal_count),
    correctedCount: Number(r.corrected_count),
    createdAt: r.created_at,
  }));
}
