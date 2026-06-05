import "server-only";

import {
  detectFormat,
  parseAgentFile,
  type AgentFileFormat,
  type AgentSpec,
  type Framework,
  type ParseAgentError,
} from "@/lib/agent-format";
import {
  additionalInstructionsFile,
  guidanceFilesFor,
} from "@/lib/agent-guidance";
import { getStableVersion } from "@/lib/agent-versions";
import { db } from "@/lib/db";
import {
  createFile,
  deleteFile,
  listDirectory,
  readFile,
  updateFile,
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

// ────────────────────────────────────────────────────────────────────
// Dispatch resolution: pick the spec a run should execute.
//
// Runs default to the agent's current STABLE snapshot (frozen in Postgres
// at promotion time) and only use the live DRAFT file when explicitly
// asked, or when the agent has never been promoted (fallback — so nothing
// breaks before the first promotion). This is the single choke point all
// five dispatch paths call; it also centralizes the parse/model/format
// validation those call sites used to duplicate.

export type ResolvedDispatch = {
  agentName: string;
  agentPath: string;
  framework: Framework;
  model: string;
  specContent: string;
  specFormat: AgentFileFormat;
  /** agent_version.id when running a stable snapshot; null for draft. */
  versionId: string | null;
  /** Human label for the run row / UI: "v3" or "draft". */
  versionLabel: string;
};

export type ResolveDispatchError =
  | { kind: "not-found"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "no-model"; message: string };

export type ResolveDispatchResult =
  | { ok: true; resolved: ResolvedDispatch }
  | { ok: false; error: ResolveDispatchError };

export async function resolveAgentForDispatch(
  workspaceId: string,
  agentName: string,
  opts: { preferDraft?: boolean } = {},
): Promise<ResolveDispatchResult> {
  // Default path: serve the current stable snapshot if one exists.
  if (!opts.preferDraft) {
    const stable = await getStableVersion(workspaceId, agentName);
    if (stable) {
      if (!stable.model) {
        return {
          ok: false,
          error: {
            kind: "no-model",
            message: `Stable v${stable.versionNumber} of "${agentName}" has no model declared.`,
          },
        };
      }
      return {
        ok: true,
        resolved: {
          agentName: stable.agentName,
          agentPath: stable.agentPath,
          framework: stable.framework,
          model: stable.model,
          specContent: stable.specContent,
          specFormat: stable.specFormat,
          versionId: stable.id,
          versionLabel: `v${stable.versionNumber}`,
        },
      };
    }
    // No stable version yet → fall through to the live file.
  }

  // Draft / fallback path: the live default-branch file.
  const found = await getAgentByName(workspaceId, agentName);
  if (!found) {
    return {
      ok: false,
      error: {
        kind: "not-found",
        message: `Agent "${agentName}" is no longer in the connected repo.`,
      },
    };
  }
  if (!found.agent.ok) {
    return {
      ok: false,
      error: {
        kind: "invalid",
        message: `Agent file failed to parse: ${found.agent.error}${found.agent.detail ? ` — ${found.agent.detail}` : ""}`,
      },
    };
  }
  const spec = found.agent.spec;
  const model = spec.model ?? "";
  if (!model) {
    return {
      ok: false,
      error: {
        kind: "no-model",
        message: `Agent "${agentName}" has no model declared. Add a model and try again.`,
      },
    };
  }
  return {
    ok: true,
    resolved: {
      agentName: spec.name,
      agentPath: found.agent.path,
      framework: spec.framework,
      model,
      specContent: found.raw,
      specFormat: found.agent.format,
      versionId: null,
      versionLabel: "draft",
    },
  };
}

// Best-effort guidance-file bootstrap + refresh. For each guidance
// file:
//   - missing → create it
//   - present + content matches what TAS ships  → leave it alone
//   - present + content differs (older TAS version, hand-edit drift)
//     → update in place with a stamped commit message
// Network/auth failures are swallowed so a hiccup never blocks the
// agent commit; the refresh-first protocol in cap-api will catch
// anything we miss here.
async function ensureGuidanceFiles(
  token: string,
  ref: RepoRef,
  framework: Framework,
): Promise<void> {
  // TAS-managed files (root AGENTS.md + agents/ subdir guides):
  // refresh on content drift so a workspace stays current with the
  // studio it's connected to.
  for (const file of guidanceFilesFor(framework)) {
    try {
      const existing = await readFile(token, ref, file.path);
      if (!existing.ok) {
        if (existing.error === "not-found") {
          await createFile(token, ref, file.path, {
            content: file.content,
            message: `Add ${file.path} (TAS agent authoring guide)`,
          });
        }
        // network / invalid-token / etc. — skip, try again on the
        // next agent commit
        continue;
      }
      if (existing.content === file.content) continue;
      await updateFile(token, ref, file.path, {
        content: file.content,
        message: `Refresh ${file.path} (TAS agent authoring guide)`,
        sha: existing.sha,
      });
    } catch {
      // ignore — guidance is a nice-to-have, not blocking
    }
  }

  // Customer-managed file: created once with a starter template, then
  // never touched again. This is where the customer adds project-
  // specific overrides that layer on top of the TAS defaults.
  await ensureAdditionalInstructionsFile(token, ref);
}

async function ensureAdditionalInstructionsFile(
  token: string,
  ref: RepoRef,
): Promise<void> {
  try {
    const file = additionalInstructionsFile();
    const existing = await readFile(token, ref, file.path);
    if (existing.ok) return; // already exists; this file is customer-owned, never overwrite
    if (existing.error !== "not-found") return; // network/auth — try again later
    await createFile(token, ref, file.path, {
      content: file.content,
      message: `Add ${file.path} (TAS customization slot)`,
    });
  } catch {
    // best-effort
  }
}

// Public form of the same bootstrap, runnable on demand (e.g. from
// a "Sync guidance" button in workspace settings). Always writes
// both frameworks' guides so a workspace using both gets fully
// caught up in one call.
export async function refreshAllGuidanceFiles(
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const repo = await getWorkspaceRepo(workspaceId);
  if (!repo) return { ok: false, error: "no-repo" };
  const token = await getWorkspaceSecretPlaintext(workspaceId, "github_pat");
  const ref: RepoRef = {
    owner: repo.owner,
    name: repo.name,
    branch: repo.defaultBranch,
  };
  // Run the per-framework path twice to cover both guides (the index
  // is shared; idempotent skip handles it the second time).
  await ensureGuidanceFiles(token, ref, "pydantic-agentspec");
  await ensureGuidanceFiles(token, ref, "cargo-ai");
  return { ok: true };
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
