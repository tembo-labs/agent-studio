import "server-only";

import { db } from "@/lib/db";

// Read-only DB views of the run table. The Rust API owns writes (creating
// runs, marking them succeeded/failed); the web layer reads for list +
// detail pages. Both surfaces hit the same Postgres so this is safe.

export type RunTrigger = "manual" | "schedule" | "event";

export type RunSummary = {
  id: string;
  agentName: string;
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: Date;
  completedAt: Date | null;
  trigger: RunTrigger;
  automationId: string | null;
};

export type AgentSummary = {
  agentName: string;
  /** Last 30 days. Both ok/failed live here, used for the success rate. */
  totalRuns30d: number;
  succeeded30d: number;
  failed30d: number;
  /** Latest run regardless of age — null when the agent has never run. */
  lastRunStatus: "queued" | "running" | "succeeded" | "failed" | null;
  lastRunAt: Date | null;
};

/**
 * Workspace agent-inventory rollup. For each name in `agentNames`,
 * returns 30-day counts + the latest-run snapshot in one round trip.
 * Agents with zero runs come back with all zeros + null last-run —
 * the inventory table still wants to render their row.
 */
export async function listAgentSummaries30d(
  workspaceId: string,
  agentNames: string[],
): Promise<Map<string, AgentSummary>> {
  const out = new Map<string, AgentSummary>();
  if (agentNames.length === 0) return out;

  // CTE: 30d aggregations + the latest run per agent. LEFT JOIN so a
  // name that exists in the repo but has no runs at all still shows
  // up — we want every agent in the inventory, not just the ones
  // that have fired.
  const { rows } = await db.query<{
    agent_name: string;
    total_runs_30d: string | null;
    succeeded_30d: string | null;
    failed_30d: string | null;
    last_run_status: AgentSummary["lastRunStatus"];
    last_run_at: Date | null;
  }>(
    `WITH agent_names AS (
        SELECT UNNEST($2::text[]) AS agent_name
     ),
     agent_stats AS (
        SELECT
            agent_name,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')                                AS total_runs_30d,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days' AND status = 'succeeded')        AS succeeded_30d,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days' AND status = 'failed')           AS failed_30d
          FROM run
         WHERE workspace_id = $1 AND agent_name = ANY($2::text[])
         GROUP BY agent_name
     ),
     latest AS (
        SELECT DISTINCT ON (agent_name) agent_name, status, created_at
          FROM run
         WHERE workspace_id = $1 AND agent_name = ANY($2::text[])
         ORDER BY agent_name, created_at DESC
     )
     SELECT
        n.agent_name,
        s.total_runs_30d::TEXT,
        s.succeeded_30d::TEXT,
        s.failed_30d::TEXT,
        l.status      AS last_run_status,
        l.created_at  AS last_run_at
       FROM agent_names n
       LEFT JOIN agent_stats s USING (agent_name)
       LEFT JOIN latest l      USING (agent_name)`,
    [workspaceId, agentNames],
  );

  for (const r of rows) {
    out.set(r.agent_name, {
      agentName: r.agent_name,
      totalRuns30d: Number(r.total_runs_30d ?? "0"),
      succeeded30d: Number(r.succeeded_30d ?? "0"),
      failed30d: Number(r.failed_30d ?? "0"),
      lastRunStatus: r.last_run_status,
      lastRunAt: r.last_run_at,
    });
  }
  return out;
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

// ── Operational dashboard aggregations ──────────────────────────────
//
// These feed the per-agent dashboard at /<workspace>/agents/<name>.
// All scoped to (workspace_id, agent_name) and the last 30 days so
// queries stay cheap and stats reflect "recent" behavior rather
// than lifetime totals (which would mask new failures behind old
// successes once an agent has been around for a while).

export type AgentStats30d = {
  totalRuns: number;
  succeeded: number;
  failed: number;
  /** Sum of cost_usd over the window, in USD. Null tokens count as 0. */
  totalCostUsd: number;
  /** Mean (completed_at - started_at), in ms, for runs that completed. */
  avgDurationMs: number | null;
};

export async function getAgentStats30d(
  workspaceId: string,
  agentName: string,
): Promise<AgentStats30d> {
  const { rows } = await db.query<{
    total_runs: string;
    succeeded: string;
    failed: string;
    total_cost_usd: string | null;
    avg_duration_ms: string | null;
  }>(
    `SELECT
        COUNT(*)::TEXT                                            AS total_runs,
        COUNT(*) FILTER (WHERE status = 'succeeded')::TEXT        AS succeeded,
        COUNT(*) FILTER (WHERE status = 'failed')::TEXT           AS failed,
        COALESCE(SUM(cost_usd), 0)::TEXT                          AS total_cost_usd,
        ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))
                    * 1000) FILTER (WHERE completed_at IS NOT NULL
                                      AND started_at IS NOT NULL))::TEXT
                                                                  AS avg_duration_ms
       FROM run
      WHERE workspace_id = $1 AND agent_name = $2
        AND created_at >= NOW() - INTERVAL '30 days'`,
    [workspaceId, agentName],
  );
  const r = rows[0];
  return {
    totalRuns: Number(r.total_runs ?? "0"),
    succeeded: Number(r.succeeded ?? "0"),
    failed: Number(r.failed ?? "0"),
    totalCostUsd: Number(r.total_cost_usd ?? "0"),
    avgDurationMs: r.avg_duration_ms ? Number(r.avg_duration_ms) : null,
  };
}

export type AgentDailyRunCount = {
  /** Calendar date in UTC, YYYY-MM-DD. */
  day: string;
  succeeded: number;
  failed: number;
  other: number;
};

/**
 * Daily run counts for the last 30 days, bucketed by `date_trunc('day',
 * created_at)` in UTC. Days with zero runs are NOT returned — callers
 * fill the gaps when rendering the trend bar so the visualisation
 * stays a fixed-width "last 30 days" regardless of activity sparsity.
 */
export async function getAgentDailyRuns30d(
  workspaceId: string,
  agentName: string,
): Promise<AgentDailyRunCount[]> {
  const { rows } = await db.query<{
    day: Date;
    succeeded: string;
    failed: string;
    other: string;
  }>(
    `SELECT
        date_trunc('day', created_at)                                AS day,
        COUNT(*) FILTER (WHERE status = 'succeeded')::TEXT           AS succeeded,
        COUNT(*) FILTER (WHERE status = 'failed')::TEXT              AS failed,
        COUNT(*) FILTER (WHERE status NOT IN ('succeeded','failed'))::TEXT
                                                                     AS other
       FROM run
      WHERE workspace_id = $1 AND agent_name = $2
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC`,
    [workspaceId, agentName],
  );
  return rows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    succeeded: Number(r.succeeded),
    failed: Number(r.failed),
    other: Number(r.other),
  }));
}

export type AgentFailureGroup = {
  /** First 120 chars of error_message, used as the grouping key. */
  errorPrefix: string;
  occurrences: number;
  lastSeen: Date;
  /** One example run id so the user can click through to the full row. */
  exampleRunId: string;
};

/**
 * Top-K failure prefixes from the last 30 days for one agent.
 * Groups by SUBSTRING(error_message FROM 1 FOR 120) so different
 * verbose tails of the same root cause collapse into one row.
 */
export type WorkspaceTopFailingAgent = {
  agentName: string;
  failures: number;
  /** Total runs in the window — denominator for the failure rate. */
  totalRuns: number;
  lastSeen: Date;
  exampleRunId: string;
};

/**
 * Top-K agents by 30-day failure count. Workspace-wide equivalent
 * of the per-agent failure-prefix grouping — at the workspace level
 * "which agent is failing" is the useful pivot, since the same
 * error string can come from very different agents.
 */
export async function listWorkspaceTopFailingAgents30d(
  workspaceId: string,
  limit = 5,
): Promise<WorkspaceTopFailingAgent[]> {
  const { rows } = await db.query<{
    agent_name: string;
    failures: string;
    total_runs: string;
    last_seen: Date;
    example_run_id: string;
  }>(
    `SELECT
        agent_name,
        COUNT(*) FILTER (WHERE status = 'failed')::TEXT  AS failures,
        COUNT(*)::TEXT                                    AS total_runs,
        MAX(created_at) FILTER (WHERE status = 'failed') AS last_seen,
        (ARRAY_AGG(id ORDER BY created_at DESC)
           FILTER (WHERE status = 'failed'))[1]          AS example_run_id
       FROM run
      WHERE workspace_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY agent_name
     HAVING COUNT(*) FILTER (WHERE status = 'failed') > 0
      ORDER BY failures DESC, last_seen DESC
      LIMIT $2`,
    [workspaceId, limit],
  );
  return rows.map((r) => ({
    agentName: r.agent_name,
    failures: Number(r.failures),
    totalRuns: Number(r.total_runs),
    lastSeen: r.last_seen,
    exampleRunId: r.example_run_id,
  }));
}

export async function getWorkspaceStats30d(
  workspaceId: string,
): Promise<AgentStats30d> {
  const { rows } = await db.query<{
    total_runs: string;
    succeeded: string;
    failed: string;
    total_cost_usd: string | null;
    avg_duration_ms: string | null;
  }>(
    `SELECT
        COUNT(*)::TEXT                                            AS total_runs,
        COUNT(*) FILTER (WHERE status = 'succeeded')::TEXT        AS succeeded,
        COUNT(*) FILTER (WHERE status = 'failed')::TEXT           AS failed,
        COALESCE(SUM(cost_usd), 0)::TEXT                          AS total_cost_usd,
        ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))
                    * 1000) FILTER (WHERE completed_at IS NOT NULL
                                      AND started_at IS NOT NULL))::TEXT
                                                                  AS avg_duration_ms
       FROM run
      WHERE workspace_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'`,
    [workspaceId],
  );
  const r = rows[0];
  return {
    totalRuns: Number(r.total_runs ?? "0"),
    succeeded: Number(r.succeeded ?? "0"),
    failed: Number(r.failed ?? "0"),
    totalCostUsd: Number(r.total_cost_usd ?? "0"),
    avgDurationMs: r.avg_duration_ms ? Number(r.avg_duration_ms) : null,
  };
}

export async function getWorkspaceDailyRuns30d(
  workspaceId: string,
): Promise<AgentDailyRunCount[]> {
  const { rows } = await db.query<{
    day: Date;
    succeeded: string;
    failed: string;
    other: string;
  }>(
    `SELECT
        date_trunc('day', created_at)                                AS day,
        COUNT(*) FILTER (WHERE status = 'succeeded')::TEXT           AS succeeded,
        COUNT(*) FILTER (WHERE status = 'failed')::TEXT              AS failed,
        COUNT(*) FILTER (WHERE status NOT IN ('succeeded','failed'))::TEXT
                                                                     AS other
       FROM run
      WHERE workspace_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC`,
    [workspaceId],
  );
  return rows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    succeeded: Number(r.succeeded),
    failed: Number(r.failed),
    other: Number(r.other),
  }));
}

export async function listAgentFailureGroups30d(
  workspaceId: string,
  agentName: string,
  limit = 5,
): Promise<AgentFailureGroup[]> {
  const { rows } = await db.query<{
    error_prefix: string;
    occurrences: string;
    last_seen: Date;
    example_run_id: string;
  }>(
    `SELECT
        SUBSTRING(COALESCE(error_message, '(no error message)')
                   FROM 1 FOR 120)                                  AS error_prefix,
        COUNT(*)::TEXT                                              AS occurrences,
        MAX(created_at)                                             AS last_seen,
        (ARRAY_AGG(id ORDER BY created_at DESC))[1]                 AS example_run_id
       FROM run
      WHERE workspace_id = $1 AND agent_name = $2
        AND status = 'failed'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY error_prefix
      ORDER BY occurrences DESC, last_seen DESC
      LIMIT $3`,
    [workspaceId, agentName, limit],
  );
  return rows.map((r) => ({
    errorPrefix: r.error_prefix,
    occurrences: Number(r.occurrences),
    lastSeen: r.last_seen,
    exampleRunId: r.example_run_id,
  }));
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
