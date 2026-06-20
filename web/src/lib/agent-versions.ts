import "server-only";

import { db } from "@/lib/db";

// Data access for the agent lifecycle (Draft -> Stable). A promotion
// snapshots the current draft spec into `agent_version` as a numbered
// version and points `agent_release` at it. Runs default to the current
// stable snapshot. Ownership lives in `agent_owner`. All keyed on
// (workspace_id, agent_name) — see migration 0037 for the identity model.

export type AgentStage = "stable" | "beta" | "draft" | "archived";
export type AgentFramework = "pydantic-agentspec" | "cargo-ai";
export type SpecFormat = "yaml" | "json";

export type AgentVersion = {
  id: string;
  workspaceId: string;
  agentName: string;
  agentPath: string;
  versionNumber: number;
  framework: AgentFramework;
  model: string | null;
  specContent: string;
  specFormat: SpecFormat;
  sourceCommitSha: string | null;
  stage: AgentStage;
  changeSummary: string | null;
  createdBy: string;
  createdAt: Date;
};

type Row = {
  id: string;
  workspace_id: string;
  agent_name: string;
  agent_path: string;
  version_number: number;
  framework: AgentFramework;
  model: string | null;
  spec_content: string;
  spec_format: SpecFormat;
  source_commit_sha: string | null;
  stage: AgentStage;
  change_summary: string | null;
  created_by: string;
  created_at: Date;
};

const COLUMNS = [
  "id",
  "workspace_id",
  "agent_name",
  "agent_path",
  "version_number",
  "framework",
  "model",
  "spec_content",
  "spec_format",
  "source_commit_sha",
  "stage",
  "change_summary",
  "created_by",
  "created_at",
] as const;
const SELECT = COLUMNS.join(", ");
const SELECT_V = COLUMNS.map((c) => `v.${c}`).join(", ");

function rowToVersion(r: Row): AgentVersion {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    agentName: r.agent_name,
    agentPath: r.agent_path,
    versionNumber: r.version_number,
    framework: r.framework,
    model: r.model,
    specContent: r.spec_content,
    specFormat: r.spec_format,
    sourceCommitSha: r.source_commit_sha,
    stage: r.stage,
    changeSummary: r.change_summary,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

/** All versions for an agent, newest first. */
export async function listAgentVersions(
  workspaceId: string,
  agentName: string,
): Promise<AgentVersion[]> {
  const { rows } = await db.query<Row>(
    `SELECT ${SELECT} FROM agent_version
      WHERE workspace_id = $1 AND agent_name = $2
      ORDER BY version_number DESC`,
    [workspaceId, agentName],
  );
  return rows.map(rowToVersion);
}

/** The current stable version (via the agent_release pointer), or null. */
export async function getStableVersion(
  workspaceId: string,
  agentName: string,
): Promise<AgentVersion | null> {
  const { rows } = await db.query<Row>(
    `SELECT ${SELECT_V}
       FROM agent_release r
       JOIN agent_version v ON v.id = r.stable_version_id
      WHERE r.workspace_id = $1 AND r.agent_name = $2
      LIMIT 1`,
    [workspaceId, agentName],
  );
  return rows[0] ? rowToVersion(rows[0]) : null;
}

/** One version by number, for the per-version detail view + diff. */
export async function getAgentVersion(
  workspaceId: string,
  agentName: string,
  versionNumber: number,
): Promise<AgentVersion | null> {
  const { rows } = await db.query<Row>(
    `SELECT ${SELECT} FROM agent_version
      WHERE workspace_id = $1 AND agent_name = $2 AND version_number = $3
      LIMIT 1`,
    [workspaceId, agentName, versionNumber],
  );
  return rows[0] ? rowToVersion(rows[0]) : null;
}

export type PromoteInput = {
  workspaceId: string;
  agentName: string;
  agentPath: string;
  framework: AgentFramework;
  model: string | null;
  specContent: string;
  specFormat: SpecFormat;
  sourceCommitSha?: string | null;
  changeSummary: string | null;
  createdBy: string;
};

/**
 * Snapshot the draft as the next version (v(N+1)) and point the stable
 * release at it — atomically. The MAX(version_number) read takes a lock so
 * two concurrent promotions can't collide on a number (the UNIQUE
 * constraint is the backstop).
 */
export async function promoteToStable(
  input: PromoteInput,
): Promise<AgentVersion> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    // Serialize concurrent promotions of the same agent for this txn so two
    // can't pick the same version_number. (FOR UPDATE can't be combined with
    // the MAX() aggregate, so we use a per-(workspace,agent) advisory lock;
    // the UNIQUE constraint is the backstop.) Released at COMMIT/ROLLBACK.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `${input.workspaceId}/${input.agentName}`,
    ]);
    const inserted = await client.query<Row>(
      `INSERT INTO agent_version
         (workspace_id, agent_name, agent_path, version_number, framework,
          model, spec_content, spec_format, source_commit_sha, stage,
          change_summary, created_by)
       VALUES (
         $1, $2, $3,
         (SELECT COALESCE(MAX(version_number), 0) + 1 FROM agent_version
           WHERE workspace_id = $1 AND agent_name = $2),
         $4, $5, $6, $7, $8, 'stable', $9, $10)
       RETURNING ${SELECT}`,
      [
        input.workspaceId,
        input.agentName,
        input.agentPath,
        input.framework,
        input.model,
        input.specContent,
        input.specFormat,
        input.sourceCommitSha ?? null,
        input.changeSummary,
        input.createdBy,
      ],
    );
    const version = rowToVersion(inserted.rows[0]);
    await client.query(
      `INSERT INTO agent_release (workspace_id, agent_name, stable_version_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, agent_name)
       DO UPDATE SET stable_version_id = EXCLUDED.stable_version_id,
                     updated_at = now()`,
      [input.workspaceId, input.agentName, version.id],
    );
    await client.query("COMMIT");
    return version;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export type AgentOwner = {
  ownerUserId: string;
  updatedBy: string;
  updatedAt: Date;
};

export async function getAgentOwner(
  workspaceId: string,
  agentName: string,
): Promise<AgentOwner | null> {
  const { rows } = await db.query<{
    owner_user_id: string;
    updated_by: string;
    updated_at: Date;
  }>(
    `SELECT owner_user_id, updated_by, updated_at FROM agent_owner
      WHERE workspace_id = $1 AND agent_name = $2 LIMIT 1`,
    [workspaceId, agentName],
  );
  const r = rows[0];
  return r
    ? { ownerUserId: r.owner_user_id, updatedBy: r.updated_by, updatedAt: r.updated_at }
    : null;
}

/** Agent names this user owns in the workspace — for the "owned + starred"
 *  default in the agents list. */
export async function listOwnedAgentNames(
  workspaceId: string,
  userId: string,
): Promise<Set<string>> {
  const { rows } = await db.query<{ agent_name: string }>(
    `SELECT agent_name FROM agent_owner
      WHERE workspace_id = $1 AND owner_user_id = $2`,
    [workspaceId, userId],
  );
  return new Set(rows.map((r) => r.agent_name));
}

export async function setAgentOwner(
  workspaceId: string,
  agentName: string,
  ownerUserId: string,
  updatedBy: string,
): Promise<void> {
  await db.query(
    `INSERT INTO agent_owner (workspace_id, agent_name, owner_user_id, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (workspace_id, agent_name)
     DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id,
                   updated_by = EXCLUDED.updated_by,
                   updated_at = now()`,
    [workspaceId, agentName, ownerUserId, updatedBy],
  );
}
