import "server-only";

import { db } from "@/lib/db";

// Per-user agent stars — a personal visibility flag (the agents list defaults to
// owned + starred, with a "view all" toggle). Keyed by (workspace, user, agent
// name); stars are a personal preference, not shared like `labels:`.

/** Agent names the user has starred in this workspace. */
export async function listStarredAgentNames(
  workspaceId: string,
  userId: string,
): Promise<Set<string>> {
  const { rows } = await db.query<{ agent_name: string }>(
    `SELECT agent_name FROM agent_star
      WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  return new Set(rows.map((r) => r.agent_name));
}

/** Star (idempotent) or unstar an agent for one user. */
export async function setAgentStar(
  workspaceId: string,
  userId: string,
  agentName: string,
  starred: boolean,
): Promise<void> {
  if (starred) {
    await db.query(
      `INSERT INTO agent_star (workspace_id, user_id, agent_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, user_id, agent_name) DO NOTHING`,
      [workspaceId, userId, agentName],
    );
  } else {
    await db.query(
      `DELETE FROM agent_star
        WHERE workspace_id = $1 AND user_id = $2 AND agent_name = $3`,
      [workspaceId, userId, agentName],
    );
  }
}
