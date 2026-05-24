import "server-only";

import { db } from "@/lib/db";

// Read-only DB views of the run table. The Rust API owns writes (creating
// runs, marking them succeeded/failed); the web layer reads for list +
// detail pages. Both surfaces hit the same Postgres so this is safe.

export type RunSummary = {
  id: string;
  agentName: string;
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: Date;
  completedAt: Date | null;
};

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
  }>(
    `SELECT id, agent_name, status, created_at, completed_at
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
  }));
}
