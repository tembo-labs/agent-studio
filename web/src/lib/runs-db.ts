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
  }>(
    `SELECT DISTINCT ON (agent_name)
            id, agent_name, status, created_at, completed_at
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
