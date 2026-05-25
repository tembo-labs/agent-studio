import "server-only";

import { db } from "@/lib/db";

// CRUD for the `improvement` table. One row per "Improve the Agent"
// submission: we create the row before calling Tembo so the
// improvement id is available to embed in the prompt (and therefore
// in the PR body), then patch the row with Tembo's task id + html
// url once the create-task call returns. PR detection runs later
// (on /improvements visits) and patches pr_url / pr_state / status.

export type ImprovementStatus = "submitted" | "pr_opened" | "merged" | "closed";

export interface Improvement {
  id: string;
  workspaceId: string;
  // Null when the improvement came from a chat-to-edit thread (not
  // anchored to a specific run).
  runId: string | null;
  agentName: string;
  agentPath: string;
  improvementText: string;
  temboTaskId: string | null;
  temboTaskHtmlUrl: string | null;
  prUrl: string | null;
  prNumber: number | null;
  prState: string | null;
  status: ImprovementStatus;
  createdBy: string;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type Row = {
  id: string;
  workspace_id: string;
  run_id: string | null;
  agent_name: string;
  agent_path: string;
  improvement_text: string;
  tembo_task_id: string | null;
  tembo_task_html_url: string | null;
  pr_url: string | null;
  pr_number: number | null;
  pr_state: string | null;
  status: ImprovementStatus;
  created_by: string;
  created_by_name: string | null;
  created_by_email: string | null;
  created_at: Date;
  updated_at: Date;
};

function rowToImprovement(r: Row): Improvement {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    runId: r.run_id,
    agentName: r.agent_name,
    agentPath: r.agent_path,
    improvementText: r.improvement_text,
    temboTaskId: r.tembo_task_id,
    temboTaskHtmlUrl: r.tembo_task_html_url,
    prUrl: r.pr_url,
    prNumber: r.pr_number,
    prState: r.pr_state,
    status: r.status,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdByEmail: r.created_by_email,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// SELECT projection with a LEFT JOIN against "user" so the row
// includes the submitter's display name + email. LEFT JOIN keeps
// the row visible if the user has been deleted.
const COLUMNS = `
  i.id, i.workspace_id, i.run_id, i.agent_name, i.agent_path, i.improvement_text,
  i.tembo_task_id, i.tembo_task_html_url, i.pr_url, i.pr_number, i.pr_state,
  i.status, i.created_by,
  u.name AS created_by_name, u.email AS created_by_email,
  i.created_at, i.updated_at
`;
const FROM_JOIN = `FROM improvement i LEFT JOIN "user" u ON u.id = i.created_by`;

export async function createImprovement(input: {
  workspaceId: string;
  runId: string | null;
  agentName: string;
  agentPath: string;
  improvementText: string;
  userId: string;
}): Promise<Improvement> {
  // INSERT into a CTE so we can re-SELECT with the user join applied,
  // matching the projection used everywhere else that returns Improvement.
  const res = await db.query<Row>(
    `WITH inserted AS (
       INSERT INTO improvement (workspace_id, run_id, agent_name, agent_path, improvement_text, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *
     )
     SELECT ${COLUMNS}
     FROM inserted i
     LEFT JOIN "user" u ON u.id = i.created_by`,
    [
      input.workspaceId,
      input.runId,
      input.agentName,
      input.agentPath,
      input.improvementText,
      input.userId,
    ],
  );
  return rowToImprovement(res.rows[0]);
}

export async function setImprovementTask(input: {
  id: string;
  temboTaskId: string | null;
  temboTaskHtmlUrl: string | null;
}): Promise<void> {
  await db.query(
    `UPDATE improvement
     SET tembo_task_id = $2, tembo_task_html_url = $3, updated_at = NOW()
     WHERE id = $1`,
    [input.id, input.temboTaskId, input.temboTaskHtmlUrl],
  );
}

export async function setImprovementPr(input: {
  id: string;
  prUrl: string | null;
  prNumber: number | null;
  prState: string | null;
  status: ImprovementStatus;
}): Promise<void> {
  await db.query(
    `UPDATE improvement
     SET pr_url = $2, pr_number = $3, pr_state = $4, status = $5, updated_at = NOW()
     WHERE id = $1`,
    [input.id, input.prUrl, input.prNumber, input.prState, input.status],
  );
}

// All improvements for a workspace whose status is not yet terminal
// (i.e. still 'submitted' or 'pr_opened'). Used to bound the scan
// the dashboard / improvements page run on every visit so a merged-
// but-not-yet-detected PR shows up regardless of how old the
// improvement row is. Terminal rows ('merged' / 'closed') never need
// rechecking.
export async function listOpenImprovements(
  workspaceId: string,
): Promise<Improvement[]> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS}
     ${FROM_JOIN}
     WHERE i.workspace_id = $1
       AND i.status IN ('submitted', 'pr_opened')
     ORDER BY i.created_at DESC`,
    [workspaceId],
  );
  return res.rows.map(rowToImprovement);
}

export async function listImprovements(
  workspaceId: string,
  limit = 100,
): Promise<Improvement[]> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS}
     ${FROM_JOIN}
     WHERE i.workspace_id = $1
     ORDER BY i.created_at DESC
     LIMIT $2`,
    [workspaceId, limit],
  );
  return res.rows.map(rowToImprovement);
}

export async function listImprovementsForAgent(
  workspaceId: string,
  agentName: string,
  limit = 100,
): Promise<Improvement[]> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS}
     ${FROM_JOIN}
     WHERE i.workspace_id = $1 AND i.agent_name = $2
     ORDER BY i.created_at ASC
     LIMIT $3`,
    [workspaceId, agentName, limit],
  );
  return res.rows.map(rowToImprovement);
}

export async function listImprovementsForRun(
  runId: string,
): Promise<Improvement[]> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS}
     ${FROM_JOIN}
     WHERE i.run_id = $1
     ORDER BY i.created_at DESC`,
    [runId],
  );
  return res.rows.map(rowToImprovement);
}

export async function getImprovement(id: string): Promise<Improvement | null> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS} ${FROM_JOIN} WHERE i.id = $1`,
    [id],
  );
  return res.rows[0] ? rowToImprovement(res.rows[0]) : null;
}

export interface ImprovementCounts {
  submitted: number;
  pr_opened: number;
  merged: number;
  closed: number;
  total: number;
}

export async function countImprovementsSince(
  workspaceId: string,
  since: Date,
): Promise<ImprovementCounts> {
  const res = await db.query<{ status: ImprovementStatus; n: string }>(
    `SELECT status, COUNT(*)::text AS n
     FROM improvement
     WHERE workspace_id = $1 AND created_at >= $2
     GROUP BY status`,
    [workspaceId, since],
  );
  const counts: ImprovementCounts = {
    submitted: 0,
    pr_opened: 0,
    merged: 0,
    closed: 0,
    total: 0,
  };
  for (const row of res.rows) {
    const n = Number(row.n);
    counts[row.status] = n;
    counts.total += n;
  }
  return counts;
}

// Marker the PR body should contain. Tembo is asked (via the
// prompt) to include this line so we can correlate the merged PR
// back to the improvement row that triggered it. The token is kept
// as TAS-Feedback-ID for backwards compatibility with PRs already
// opened against earlier database rows — the wire format is frozen
// even though the database column was renamed.
export const IMPROVEMENT_MARKER_PREFIX = "TAS-Feedback-ID:";

export function improvementMarker(id: string): string {
  return `${IMPROVEMENT_MARKER_PREFIX} ${id}`;
}
