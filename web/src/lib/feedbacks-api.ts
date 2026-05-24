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
  runId: string;
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
  createdAt: Date;
  updatedAt: Date;
}

type Row = {
  id: string;
  workspace_id: string;
  run_id: string;
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
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const COLUMNS = `
  id, workspace_id, run_id, agent_name, agent_path, feedback_text,
  tembo_task_id, tembo_task_html_url, pr_url, pr_number, pr_state,
  status, created_by, created_at, updated_at
`;

export async function createFeedback(input: {
  workspaceId: string;
  runId: string;
  agentName: string;
  agentPath: string;
  feedbackText: string;
  userId: string;
}): Promise<Feedback> {
  const res = await db.query<Row>(
    `INSERT INTO feedback (workspace_id, run_id, agent_name, agent_path, feedback_text, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
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

export async function listFeedbacks(
  workspaceId: string,
  limit = 100,
): Promise<Feedback[]> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS}
     FROM feedback
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [workspaceId, limit],
  );
  return res.rows.map(rowToFeedback);
}

export async function listFeedbacksForRun(
  runId: string,
): Promise<Feedback[]> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS}
     FROM feedback
     WHERE run_id = $1
     ORDER BY created_at DESC`,
    [runId],
  );
  return res.rows.map(rowToFeedback);
}

export async function getFeedback(id: string): Promise<Feedback | null> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS} FROM feedback WHERE id = $1`,
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
