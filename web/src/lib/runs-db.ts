import "server-only";

import { db } from "@/lib/db";

// Read-only DB views of the run table. The Rust API owns writes (creating
// runs, marking them succeeded/failed); the web layer reads for list +
// detail pages. Both surfaces hit the same Postgres so this is safe.

export type RunTrigger = "manual" | "schedule";

export type RunSummary = {
  id: string;
  agentName: string;
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: Date;
  completedAt: Date | null;
  trigger: RunTrigger;
  automationId: string | null;
};

/**
 * For each agent name in `agentNames`, return the most recent run row
 * (or omit the entry if the agent has no runs yet). One round-trip via
 * Postgres DISTINCT ON.
 */
export async function getLatestRunPerAgent(
  workspaceId: string,
  agentNames: string[],
): Promise<Map<string, RunSummary>> {
  if (agentNames.length === 0) return new Map();
  const { rows } = await db.query<{
    id: string;
    agent_name: string;
    status: RunSummary["status"];
    created_at: Date;
    completed_at: Date | null;
    trigger: RunTrigger;
    automation_id: string | null;
  }>(
    `SELECT DISTINCT ON (agent_name)
            id, agent_name, status, created_at, completed_at, trigger, automation_id
       FROM run
      WHERE workspace_id = $1 AND agent_name = ANY($2::text[])
      ORDER BY agent_name, created_at DESC`,
    [workspaceId, agentNames],
  );
  return new Map(
    rows.map((r) => [
      r.agent_name,
      {
        id: r.id,
        agentName: r.agent_name,
        status: r.status,
        createdAt: r.created_at,
        completedAt: r.completed_at,
        trigger: r.trigger,
        automationId: r.automation_id,
      },
    ]),
  );
}

// Runs that originated from the /chat composer (non-empty
// user_message). "Run now" runs come through with an empty
// user_message — they're not part of the conversation thread, so
// we skip them here. Returns the user message + agent output so
// the chat UI can render both halves of each turn.
export interface ChatRun {
  id: string;
  agentName: string;
  status: "queued" | "running" | "succeeded" | "failed";
  userMessage: string;
  output: string;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export async function listChatRunsForAgent(
  workspaceId: string,
  agentName: string,
  limit = 50,
): Promise<ChatRun[]> {
  const { rows } = await db.query<{
    id: string;
    agent_name: string;
    status: ChatRun["status"];
    user_message: string;
    output: string;
    error_message: string | null;
    created_at: Date;
    completed_at: Date | null;
  }>(
    `SELECT id, agent_name, status, user_message, output, error_message, created_at, completed_at
       FROM run
      WHERE workspace_id = $1 AND agent_name = $2
        AND user_message IS NOT NULL AND user_message <> ''
      ORDER BY created_at ASC
      LIMIT $3`,
    [workspaceId, agentName, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    agentName: r.agent_name,
    status: r.status,
    userMessage: r.user_message,
    output: r.output,
    errorMessage: r.error_message,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  }));
}

/**
 * Returns the distinct agent names that have at least one run in the
 * workspace — across all time. Used by the dashboard to count "agents
 * ever with at least one run".
 */
export async function listAgentNamesWithRuns(
  workspaceId: string,
): Promise<string[]> {
  const { rows } = await db.query<{ agent_name: string }>(
    `SELECT DISTINCT agent_name
       FROM run
      WHERE workspace_id = $1`,
    [workspaceId],
  );
  return rows.map((r) => r.agent_name);
}

/**
 * Total count of `run` rows in the workspace, no filters. Drives the
 * "total runs all time" stat on the dashboard.
 */
export async function countRunsForWorkspace(
  workspaceId: string,
): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM run WHERE workspace_id = $1`,
    [workspaceId],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Count of runs whose agent_name is in the supplied list. Caller
 * passes the names of currently-active (still-in-repo) agents to
 * get "total runs across active agents". Empty input short-circuits
 * to 0.
 */
export async function countRunsForAgents(
  workspaceId: string,
  agentNames: string[],
): Promise<number> {
  if (agentNames.length === 0) return 0;
  const { rows } = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
       FROM run
      WHERE workspace_id = $1 AND agent_name = ANY($2)`,
    [workspaceId, agentNames],
  );
  return Number(rows[0]?.n ?? 0);
}

// Workspace-wide run list with optional filters. Status / trigger
// arrays use ANY() so an empty array means "no filter" via NULL
// coalescing on the parameter; agentName is a scalar; search runs an
// ILIKE on user_message + output. Pagination is cursor-by-created_at
// (descending), passing the last seen createdAt as `before` for the
// next page. limit is enforced server-side to keep queries cheap.

export type RunListFilters = {
  statuses?: RunSummary["status"][];
  agentName?: string;
  triggers?: RunTrigger[];
  search?: string;
};

export type RunListItem = {
  id: string;
  agentName: string;
  status: RunSummary["status"];
  trigger: RunTrigger;
  automationId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  // First slice of the user_message so the list row can preview the
  // input without round-tripping to the run detail page. Empty when
  // the run had no input (the manual "Run now" path).
  userMessagePreview: string;
  // Estimated USD cost — computed + persisted by the Rust runner at
  // mark_succeeded time so the UI doesn't recompute every render.
  // Null for: runs that pre-date the column, frameworks that don't
  // report token usage (cargo-ai today), or models not in the
  // pricing table.
  costUsd: number | null;
};

const LIST_RUNS_MAX_PAGE = 50;

export async function listRunsForWorkspace(
  workspaceId: string,
  filters: RunListFilters,
  options: { limit?: number; before?: Date } = {},
): Promise<RunListItem[]> {
  const limit = Math.min(Math.max(1, options.limit ?? LIST_RUNS_MAX_PAGE), LIST_RUNS_MAX_PAGE);
  const params: unknown[] = [workspaceId];
  // Track each filter as a SQL fragment that references positional
  // placeholders we push into `params`. We build the WHERE in order
  // so the query is deterministic + readable in pg logs.
  const where: string[] = [`workspace_id = $1`];

  if (filters.statuses && filters.statuses.length > 0) {
    params.push(filters.statuses);
    where.push(`status = ANY($${params.length}::text[])`);
  }
  if (filters.agentName && filters.agentName.trim()) {
    params.push(filters.agentName.trim());
    where.push(`agent_name = $${params.length}`);
  }
  if (filters.triggers && filters.triggers.length > 0) {
    params.push(filters.triggers);
    where.push(`trigger = ANY($${params.length}::text[])`);
  }
  if (filters.search && filters.search.trim()) {
    // Single placeholder reused twice via a CTE-free OR; ILIKE on
    // both user_message and output. Caller is expected to keep
    // the search term short (~200 chars) — the UI input enforces
    // that.
    params.push(`%${filters.search.trim()}%`);
    where.push(
      `(user_message ILIKE $${params.length} OR output ILIKE $${params.length})`,
    );
  }
  if (options.before) {
    params.push(options.before);
    where.push(`created_at < $${params.length}`);
  }

  params.push(limit);

  const { rows } = await db.query<{
    id: string;
    agent_name: string;
    status: RunSummary["status"];
    trigger: RunTrigger;
    automation_id: string | null;
    created_at: Date;
    started_at: Date | null;
    completed_at: Date | null;
    user_message: string;
    // pg returns NUMERIC as a string by default to preserve precision.
    // Parse on the way out.
    cost_usd: string | null;
  }>(
    `SELECT id, agent_name, status, trigger, automation_id,
            created_at, started_at, completed_at, user_message,
            cost_usd
       FROM run
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${params.length}`,
    params,
  );

  return rows.map((r) => ({
    id: r.id,
    agentName: r.agent_name,
    status: r.status,
    trigger: r.trigger,
    automationId: r.automation_id,
    createdAt: r.created_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    userMessagePreview: (r.user_message ?? "").slice(0, 200),
    costUsd: r.cost_usd === null ? null : Number(r.cost_usd),
  }));
}

// Distinct agent names that have ever produced a run, scoped to a
// workspace. Powers the agent picker on /runs so users only see
// agents with history (not the full repo list, which can include
// recently-created agents that haven't run).
export async function listAgentNamesWithRunsForWorkspace(
  workspaceId: string,
): Promise<string[]> {
  const { rows } = await db.query<{ agent_name: string }>(
    `SELECT DISTINCT agent_name
       FROM run
      WHERE workspace_id = $1
      ORDER BY agent_name ASC`,
    [workspaceId],
  );
  return rows.map((r) => r.agent_name);
}

export async function listRecentRunsForAgent(
  workspaceId: string,
  agentName: string,
  limit = 10,
): Promise<RunSummary[]> {
  const { rows } = await db.query<{
    id: string;
    agent_name: string;
    status: RunSummary["status"];
    created_at: Date;
    completed_at: Date | null;
    trigger: RunTrigger;
    automation_id: string | null;
  }>(
    `SELECT id, agent_name, status, created_at, completed_at, trigger, automation_id
       FROM run
      WHERE workspace_id = $1 AND agent_name = $2
      ORDER BY created_at DESC
      LIMIT $3`,
    [workspaceId, agentName, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    agentName: r.agent_name,
    status: r.status,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    trigger: r.trigger,
    automationId: r.automation_id,
  }));
}
