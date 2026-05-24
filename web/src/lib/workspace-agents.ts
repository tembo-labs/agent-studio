import "server-only";

import {
  detectFormat,
  parseAgentContent,
  parseAgentFile,
  renderCargoStarter,
  renderStarter,
  validateAgentName,
  type AgentFileFormat,
  type AgentSpec,
  type Framework,
  type ParseAgentError,
} from "@/lib/agent-format";
import { db } from "@/lib/db";
import {
  createFile,
  deleteFile,
  listDirectory,
  readFile,
  type GitHubFileError,
  type RepoRef,
} from "@/lib/github";
import { getWorkspaceRepo, getWorkspaceSecretPlaintext } from "@/lib/workspace";

const AGENTS_DIR = "agents";

// Where new agents are written, per framework. The repo's `agents/`
// directory uses one subfolder per supported framework so v0.3+ multi-
// file frameworks (LangGraph, Mastra, …) slot in cleanly without
// migration churn. v0.1 still *reads* agents directly under agents/
// (legacy flat layout) so existing workspaces keep working.
const FRAMEWORK_DIRS: Record<Framework, string> = {
  "pydantic-agentspec": "pydantic-agentspec",
  "cargo-ai": "cargo-ai",
};

const FRAMEWORK_DIR_VALUES = Object.values(FRAMEWORK_DIRS);

export type ListedAgent =
  | {
      filename: string;
      path: string;
      format: AgentFileFormat;
      ok: true;
      spec: AgentSpec;
    }
  | {
      filename: string;
      path: string;
      format: AgentFileFormat | null;
      ok: false;
      error: ParseAgentError;
      detail?: string;
    };

export type ListAgentsResult =
  | { ok: true; agents: ListedAgent[] }
  | { ok: false; error: GitHubFileError | "no-repo"; detail?: string };

/**
 * Walk the connected repo's `agents/` tree and parse every file we find.
 *
 *   agents/pydantic-agentspec/   one Pydantic AgentSpec file per agent
 *   agents/cargo-ai/             one Cargo AI JSON file per agent
 *
 * Only the framework subfolders are read. Files placed directly at
 * `agents/foo.yaml` are ignored — move them into the right subfolder.
 * Invalid files are surfaced inline with their parser error rather than
 * silently filtered (US-0.1-05 explicitly rejects "silent failure").
 */
export async function listAgents(workspaceId: string): Promise<ListAgentsResult> {
  const repo = await getWorkspaceRepo(workspaceId);
  if (!repo) return { ok: false, error: "no-repo" };

  const token = await getWorkspaceSecretPlaintext(workspaceId, "github_pat");
  const ref: RepoRef = {
    owner: repo.owner,
    name: repo.name,
    branch: repo.defaultBranch,
  };

  // Walk each framework subfolder. Missing subfolders are normal (a
  // fresh repo won't have an agents/cargo-ai/ directory yet) — those
  // surface as `entries: []` from listDirectory's `missing: true` path.
  const subfolderListings = await Promise.all(
    FRAMEWORK_DIR_VALUES.map((dir) =>
      listDirectory(token, ref, `${AGENTS_DIR}/${dir}`),
    ),
  );

  for (const sub of subfolderListings) {
    if (!sub.ok) {
      return { ok: false, error: sub.error, detail: sub.detail };
    }
  }

  const allEntries = subfolderListings.flatMap((sub) =>
    sub.ok
      ? sub.entries.filter(
          (e) => e.type === "file" && detectFormat(e.name) !== null,
        )
      : [],
  );

  const agents = await Promise.all(
    allEntries.map(async (entry): Promise<ListedAgent> => {
      const read = await readFile(token, ref, entry.path);
      if (!read.ok) {
        return {
          filename: entry.name,
          path: entry.path,
          format: detectFormat(entry.name),
          ok: false,
          error: "invalid-yaml",
          detail: read.detail ?? read.error,
        };
      }
      const parsed = parseAgentFile(entry.name, read.content);
      if (!parsed.ok) {
        return {
          filename: entry.name,
          path: entry.path,
          format: detectFormat(entry.name),
          ok: false,
          error: parsed.error,
          detail: parsed.detail,
        };
      }
      return {
        filename: entry.name,
        path: entry.path,
        format: parsed.format,
        ok: true,
        spec: parsed.spec,
      };
    }),
  );

  // Stable order: valid first (by name), then invalid (by filename).
  agents.sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    const an = a.ok ? a.spec.name : a.filename;
    const bn = b.ok ? b.spec.name : b.filename;
    return an.localeCompare(bn);
  });

  return { ok: true, agents };
}

/**
 * Find one agent by its declared name. Returns:
 *  - the agent (valid or invalid) if a file in agents/** parses to that name
 *  - the invalid file if its filename basename matches (so broken specs
 *    are still inspectable on the detail page)
 *  - null otherwise
 */
export async function getAgentByName(
  workspaceId: string,
  agentName: string,
): Promise<{
  agent: ListedAgent;
  raw: string;
} | null> {
  const list = await listAgents(workspaceId);
  if (!list.ok) return null;

  const match = list.agents.find((a) => {
    if (a.ok) return a.spec.name === agentName;
    const base = a.filename.replace(/\.(yaml|yml|json)$/i, "");
    return base === agentName;
  });
  if (!match) return null;

  const repo = await getWorkspaceRepo(workspaceId);
  if (!repo) return null;
  const token = await getWorkspaceSecretPlaintext(workspaceId, "github_pat");
  const read = await readFile(
    token,
    { owner: repo.owner, name: repo.name, branch: repo.defaultBranch },
    match.path,
  );
  if (!read.ok) return null;
  return { agent: match, raw: read.content };
}

export type CreateAgentError =
  | "no-repo"
  | "invalid-name"
  | "name-taken"
  | ParseAgentError
  | GitHubFileError;

export type CreateAgentResult =
  | { ok: true; filename: string; path: string; commitSha: string }
  | { ok: false; error: CreateAgentError; detail?: string };

async function nameAlreadyExists(
  workspaceId: string,
  name: string,
): Promise<boolean> {
  const list = await listAgents(workspaceId);
  if (!list.ok) return false;
  return list.agents.some((a) => {
    if (a.ok) return a.spec.name === name;
    const base = a.filename.replace(/\.(yaml|yml|json)$/i, "");
    return base === name;
  });
}

async function commitAgentFile(
  workspaceId: string,
  framework: Framework,
  filename: string,
  content: string,
  commitMessage: string,
): Promise<CreateAgentResult> {
  const repo = await getWorkspaceRepo(workspaceId);
  if (!repo) return { ok: false, error: "no-repo" };

  const token = await getWorkspaceSecretPlaintext(workspaceId, "github_pat");
  const ref: RepoRef = {
    owner: repo.owner,
    name: repo.name,
    branch: repo.defaultBranch,
  };
  const path = `${AGENTS_DIR}/${FRAMEWORK_DIRS[framework]}/${filename}`;

  const result = await createFile(token, ref, path, {
    content,
    message: commitMessage,
  });
  if (!result.ok) {
    return { ok: false, error: result.error, detail: result.detail };
  }
  return { ok: true, filename, path, commitSha: result.commitSha };
}

export async function createAgentFromTemplate(
  workspaceId: string,
  name: string,
  framework: Framework,
): Promise<CreateAgentResult> {
  if (!validateAgentName(name)) {
    return {
      ok: false,
      error: "invalid-name",
      detail: "Use 2–64 chars, lowercase letters, digits, and hyphens.",
    };
  }
  if (await nameAlreadyExists(workspaceId, name)) {
    return {
      ok: false,
      error: "name-taken",
      detail: "An agent with this name already exists in the repo.",
    };
  }
  let content: string;
  let filename: string;
  if (framework === "pydantic-agentspec") {
    content = renderStarter(name);
    filename = `${name}.yaml`;
  } else {
    content = renderCargoStarter(name);
    filename = `${name}.json`;
  }
  return commitAgentFile(
    workspaceId,
    framework,
    filename,
    content,
    `Create agent: ${name} (from ${framework} starter template)`,
  );
}

export async function createAgentFromContent(
  workspaceId: string,
  format: AgentFileFormat,
  content: string,
): Promise<CreateAgentResult> {
  const parsed = parseAgentContent(content, format);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, detail: parsed.detail };
  }
  if (await nameAlreadyExists(workspaceId, parsed.spec.name)) {
    return {
      ok: false,
      error: "name-taken",
      detail: "An agent with this name already exists in the repo.",
    };
  }
  const filename = `${parsed.spec.name}.${format === "yaml" ? "yaml" : "json"}`;
  return commitAgentFile(
    workspaceId,
    parsed.spec.framework,
    filename,
    content,
    `Create agent: ${parsed.spec.name}`,
  );
}

// ── Delete + restore ─────────────────────────────────────────────────────

export type DeleteAgentError =
  | "no-repo"
  | "not-found"
  | GitHubFileError
  | "sha-mismatch";

export type DeleteAgentResult =
  | { ok: true; commitSha: string }
  | { ok: false; error: DeleteAgentError; detail?: string };

export async function deleteAgent(
  workspaceId: string,
  userId: string,
  agentName: string,
): Promise<DeleteAgentResult> {
  const repo = await getWorkspaceRepo(workspaceId);
  if (!repo) return { ok: false, error: "no-repo" };

  const found = await getAgentByName(workspaceId, agentName);
  if (!found) return { ok: false, error: "not-found" };

  const token = await getWorkspaceSecretPlaintext(workspaceId, "github_pat");
  const ref: RepoRef = {
    owner: repo.owner,
    name: repo.name,
    branch: repo.defaultBranch,
  };

  const read = await readFile(token, ref, found.agent.path);
  if (!read.ok) {
    return {
      ok: false,
      error: read.error,
      detail: read.detail,
    };
  }

  const del = await deleteFile(token, ref, found.agent.path, {
    sha: read.sha,
    message: `Delete agent: ${agentName}`,
  });
  if (!del.ok) return { ok: false, error: del.error, detail: del.detail };

  await db.query(
    `INSERT INTO workspace_agent_deletion
       (workspace_id, agent_name, file_path, content_snapshot,
        deletion_commit_sha, deleted_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      workspaceId,
      agentName,
      found.agent.path,
      read.content,
      del.commitSha,
      userId,
    ],
  );

  return { ok: true, commitSha: del.commitSha };
}

export type DeletedAgent = {
  id: string;
  agentName: string;
  filePath: string;
  deletionCommitSha: string;
  deletedAt: Date;
  deletedBy: string;
};

export async function listDeletedAgents(
  workspaceId: string,
): Promise<DeletedAgent[]> {
  const { rows } = await db.query<{
    id: string;
    agent_name: string;
    file_path: string;
    deletion_commit_sha: string;
    deleted_at: Date;
    deleted_by: string;
  }>(
    `SELECT id, agent_name, file_path, deletion_commit_sha,
            deleted_at, deleted_by
       FROM workspace_agent_deletion
      WHERE workspace_id = $1 AND restored_at IS NULL
      ORDER BY deleted_at DESC`,
    [workspaceId],
  );
  return rows.map((r) => ({
    id: r.id,
    agentName: r.agent_name,
    filePath: r.file_path,
    deletionCommitSha: r.deletion_commit_sha,
    deletedAt: r.deleted_at,
    deletedBy: r.deleted_by,
  }));
}

export type RestoreAgentError =
  | "no-repo"
  | "not-found"
  | "already-restored"
  | GitHubFileError;

export type RestoreAgentResult =
  | { ok: true; commitSha: string; agentName: string }
  | { ok: false; error: RestoreAgentError; detail?: string };

export async function restoreAgent(
  workspaceId: string,
  userId: string,
  deletionId: string,
): Promise<RestoreAgentResult> {
  const repo = await getWorkspaceRepo(workspaceId);
  if (!repo) return { ok: false, error: "no-repo" };

  const { rows } = await db.query<{
    agent_name: string;
    file_path: string;
    content_snapshot: string;
    restored_at: Date | null;
  }>(
    `SELECT agent_name, file_path, content_snapshot, restored_at
       FROM workspace_agent_deletion
      WHERE id = $1 AND workspace_id = $2`,
    [deletionId, workspaceId],
  );
  const row = rows[0];
  if (!row) return { ok: false, error: "not-found" };
  if (row.restored_at) return { ok: false, error: "already-restored" };

  const token = await getWorkspaceSecretPlaintext(workspaceId, "github_pat");
  const ref: RepoRef = {
    owner: repo.owner,
    name: repo.name,
    branch: repo.defaultBranch,
  };

  const create = await createFile(token, ref, row.file_path, {
    content: row.content_snapshot,
    message: `Restore agent: ${row.agent_name}`,
  });
  if (!create.ok) {
    return { ok: false, error: create.error, detail: create.detail };
  }

  await db.query(
    `UPDATE workspace_agent_deletion
       SET restored_at = NOW(),
           restored_by = $1,
           restore_commit_sha = $2
       WHERE id = $3`,
    [userId, create.commitSha, deletionId],
  );

  return {
    ok: true,
    commitSha: create.commitSha,
    agentName: row.agent_name,
  };
}
