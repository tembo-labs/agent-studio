import "server-only";

import { db } from "@/lib/db";

// The per-agent "Locked" flag (migration 0061). When an agent is locked, end
// users can't drive changes: Chat to edit / Improve / learning capture are
// removed, and the Versions / Activity / Learning history tabs are hidden. The
// agent then changes only via direct repo PRs. Admin-set + audited (see
// setAgentLockAction). Distinct from learning mode — locking also forces
// learning off (the scheduler skips locked agents).

export async function isAgentLocked(
  workspaceId: string,
  agentName: string,
): Promise<boolean> {
  const { rows } = await db.query<{ locked: boolean }>(
    `SELECT locked FROM agent_lock WHERE workspace_id = $1 AND agent_name = $2`,
    [workspaceId, agentName],
  );
  return rows[0]?.locked ?? false;
}

/** Names of every locked agent in the workspace — for list badges / scans. */
export async function listLockedAgentNames(
  workspaceId: string,
): Promise<Set<string>> {
  const { rows } = await db.query<{ agent_name: string }>(
    `SELECT agent_name FROM agent_lock WHERE workspace_id = $1 AND locked`,
    [workspaceId],
  );
  return new Set(rows.map((r) => r.agent_name));
}

/** Upsert the per-agent lock. `updatedBy` is the admin who flipped it. */
export async function setAgentLock(
  workspaceId: string,
  agentName: string,
  locked: boolean,
  updatedBy: string,
): Promise<void> {
  await db.query(
    `INSERT INTO agent_lock (workspace_id, agent_name, locked, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (workspace_id, agent_name)
     DO UPDATE SET locked = $3, updated_by = $4, updated_at = NOW()`,
    [workspaceId, agentName, locked, updatedBy],
  );
}
