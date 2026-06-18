import "server-only";

import { db } from "@/lib/db";

// CRUD + scheduler queries for the `agent_learning` table — per-agent "learning
// mode" config that drives the batched Tasks Inbox learning loop. The scheduler
// reads listDueLearningConfigs() each cycle; the agent settings UI reads/writes
// the per-agent row.

export type LearningCadence = "daily" | "weekly";

export interface AgentLearning {
  workspaceId: string;
  agentName: string;
  enabled: boolean;
  cadence: LearningCadence;
  ownerUserId: string | null;
  lastLearnedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type Row = {
  workspace_id: string;
  agent_name: string;
  enabled: boolean;
  cadence: LearningCadence;
  owner_user_id: string | null;
  last_learned_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function rowTo(r: Row): AgentLearning {
  return {
    workspaceId: r.workspace_id,
    agentName: r.agent_name,
    enabled: r.enabled,
    cadence: r.cadence,
    ownerUserId: r.owner_user_id,
    lastLearnedAt: r.last_learned_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const COLUMNS = `workspace_id, agent_name, enabled, cadence, owner_user_id,
  last_learned_at, created_at, updated_at`;

export async function getAgentLearning(
  workspaceId: string,
  agentName: string,
): Promise<AgentLearning | null> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS} FROM agent_learning
      WHERE workspace_id = $1 AND agent_name = $2`,
    [workspaceId, agentName],
  );
  return res.rows[0] ? rowTo(res.rows[0]) : null;
}

/** Upsert the per-agent config. Used by the settings UI's server action. */
export async function upsertAgentLearning(input: {
  workspaceId: string;
  agentName: string;
  enabled: boolean;
  cadence: LearningCadence;
  ownerUserId: string;
}): Promise<AgentLearning> {
  const res = await db.query<Row>(
    `INSERT INTO agent_learning (workspace_id, agent_name, enabled, cadence, owner_user_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (workspace_id, agent_name)
     DO UPDATE SET enabled = $3, cadence = $4, owner_user_id = $5, updated_at = NOW()
     RETURNING ${COLUMNS}`,
    [input.workspaceId, input.agentName, input.enabled, input.cadence, input.ownerUserId],
  );
  return rowTo(res.rows[0]);
}

/**
 * Enabled configs whose cadence window has elapsed since last_learned_at (or
 * that have never run). The scheduler calls this each cycle. Cadence → interval
 * is enforced in SQL so a not-yet-due agent is never fetched.
 */
export async function listDueLearningConfigs(
  now: Date,
): Promise<AgentLearning[]> {
  const res = await db.query<Row>(
    `SELECT ${COLUMNS} FROM agent_learning
      WHERE enabled
        AND owner_user_id IS NOT NULL
        AND (
          last_learned_at IS NULL
          OR last_learned_at < $1::timestamptz - (
            CASE cadence WHEN 'daily' THEN INTERVAL '1 day'
                         ELSE INTERVAL '7 days' END
          )
        )`,
    [now],
  );
  return res.rows.map(rowTo);
}

/** Advance the cadence floor after a learning cycle (fired or no-op). */
export async function setAgentLearned(
  workspaceId: string,
  agentName: string,
  at: Date,
): Promise<void> {
  await db.query(
    `UPDATE agent_learning
        SET last_learned_at = $3, updated_at = NOW()
      WHERE workspace_id = $1 AND agent_name = $2`,
    [workspaceId, agentName, at],
  );
}
