import "server-only";

import { db } from "@/lib/db";

// CRUD for the `feedback` table. One row per "Improve the Agent"
// submission: we create the row before calling Tembo so the
// feedback id is available to embed in the prompt (and therefore in
// the PR body), then patch the row with Tembo's task id + html url
// once the create-task call returns. PR detection runs later (on
// /feedbacks visits) and patches pr_url / pr_state / status.

export type FeedbackStatus = "submitted" | "pr_opened" | "merged" | "closed";

export interface Feedback {
  id: string;
  workspaceId: string;
  // Null when the feedback came from a chat-to-edit thread (not
  // anchored to a specific run).
  runId: string | null;
  agentName: string;
  agentPath: string;
  feedbackText: string;
  temboTaskId: string | null;
  temboTaskHtmlUrl: string | null;
  prUrl: string | null;
  prNumber: number | null;
  prState: string | null;
  status: FeedbackStatus;
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
  feedback_text: string;
  tembo_task_id: string | null;
  tembo_task_html_url: string | null;
  pr_url: string | null;
  pr_number: number | null;
  pr_state: string | null;
  status: FeedbackStatus;
  created_by: string;
  created_by_name: string | null;
  created_by_email: string | null;
  created_at: Date;
  updated_at: Date;
};

function rowToFeedback(r: Row): Feedback {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    runId: r.run_id,
    agentName: r.agent_name,
    agentPath: r.agent_path,
    feedbackText: r.feedback_text,
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
  f.id, f.workspace_id, f.run_id, f.agent_name, f.agent_path, f.feedback_text,
  f.tembo_task_id, f.tembo_task_html_url, f.pr_url, f.pr_number, f.pr_state,
  f.status, f.created_by,
  u.name AS created_by_name, u.email AS created_by_email,
  f.created_at, f.updated_at
`;
const FROM_JOIN = `FROM feedback f LEFT JOIN "user" u ON u.id = f.created_by`;

export async function createFeedback(input: {
  workspaceId: string;
  runId: string | null;
  agentName: string;
  agentPath: string;
  feedbackText: string;
  userId: string;
}): Promise<Feedback> {
  // INSERT into a CTE so we can re-SELECT with the user join applied,
  // matching the projection used everywhere else that returns Feedback.
  const res = await db.query<Row>(
    `WITH inserted AS (
       INSERT INTO feedback (workspace_id, run_id, agent_name, agent_path, feedback_text, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *
     )
     SELECT ${COLUMNS}
     FROM inserted f
     LEFT JOIN "user" u ON u.id = f.created_by`,
    [
      input.workspaceId,
      input.runId,
      input.agentName,
      input.agentPath,
      input.feedbackText,
      input.userId,
    ],
  );
  return rowToFeedback(res.rows[0]);
}

export async function setFeedbackTask(input: {
  id: string;
  temboTaskId: string | null;
  temboTaskHtmlUrl: string | null;
}): Promise<void> {
  await db.query(
    `UPDATE feedback
     SET tembo_task_id = $2, tembo_task_html_url = $3, updated_at = NOW()
     WHERE id = $1`,
    [input.id, input.temboTaskId, input.temboTaskHtmlUrl],
  );
}

export async function setFeedbackPr(input: {
  id: string;
  prUrl: string | null;
  prNumber: number | null;
  prState: string | null;
  status: FeedbackStatus;
}): Promise<void> {
  await db.query(
    `UPDATE feedback
     SET pr_url = $2, pr_number = $3, pr_state = $4, status = $5, updated_at = NOW()
     WHERE id = $1`,
    [input.id, input.prUrl, input.prNumber, input.prState, input.status],
  );
}

// All feedbacks for a workspace whose status is not yet terminal
// (i.e. still 'submitted' or 'pr_opened'). Used to bound the scan
// the dashboard / feedbacks page run on every visit so a merged-but-
// not-yet-detected PR shows up regardless of how old the feedback
// row is. Terminal rows ('merged' / 'closed') never need rechecking.
export async function listOpenFeedbacks(
  workspaceId: string,
): Promise<Feedback[]> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS}
     ${FROM_JOIN}
     WHERE f.workspace_id = $1
       AND f.status IN ('submitted', 'pr_opened')
     ORDER BY f.created_at DESC`,
    [workspaceId],
  );
  return res.rows.map(rowToFeedback);
}

export async function listFeedbacks(
  workspaceId: string,
  limit = 100,
): Promise<Feedback[]> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS}
     ${FROM_JOIN}
     WHERE f.workspace_id = $1
     ORDER BY f.created_at DESC
     LIMIT $2`,
    [workspaceId, limit],
  );
  return res.rows.map(rowToFeedback);
}

export async function listFeedbacksForAgent(
  workspaceId: string,
  agentName: string,
  limit = 100,
): Promise<Feedback[]> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS}
     ${FROM_JOIN}
     WHERE f.workspace_id = $1 AND f.agent_name = $2
     ORDER BY f.created_at ASC
     LIMIT $3`,
    [workspaceId, agentName, limit],
  );
  return res.rows.map(rowToFeedback);
}

export async function listFeedbacksForRun(
  runId: string,
): Promise<Feedback[]> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS}
     ${FROM_JOIN}
     WHERE f.run_id = $1
     ORDER BY f.created_at DESC`,
    [runId],
  );
  return res.rows.map(rowToFeedback);
}

export async function getFeedback(id: string): Promise<Feedback | null> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS} ${FROM_JOIN} WHERE f.id = $1`,
    [id],
  );
  return res.rows[0] ? rowToFeedback(res.rows[0]) : null;
}

export interface FeedbackCounts {
  submitted: number;
  pr_opened: number;
  merged: number;
  closed: number;
  total: number;
}

export async function countFeedbacksSince(
  workspaceId: string,
  since: Date,
): Promise<FeedbackCounts> {
  const res = await db.query<{ status: FeedbackStatus; n: string }>(
    `SELECT status, COUNT(*)::text AS n
     FROM feedback
     WHERE workspace_id = $1 AND created_at >= $2
     GROUP BY status`,
    [workspaceId, since],
  );
  const counts: FeedbackCounts = {
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
// back to the feedback row that triggered it.
export const FEEDBACK_MARKER_PREFIX = "TAS-Feedback-ID:";

export function feedbackMarker(id: string): string {
  return `${FEEDBACK_MARKER_PREFIX} ${id}`;
}
