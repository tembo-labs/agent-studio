import "server-only";

import {
  detectFormat,
  parseAgentContent,
  parseAgentFile,
  renderStarter,
  validateAgentName,
  type AgentFileFormat,
  type AgentSpec,
  type Harness,
  type ParseAgentError,
} from "@/lib/agent-format";
import {
  createFile,
  listDirectory,
  readFile,
  type GitHubFileError,
  type RepoRef,
} from "@/lib/github";
import { getWorkspaceRepo, getWorkspaceSecretPlaintext } from "@/lib/workspace";

const AGENTS_DIR = "agents";

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
 * Loads the connected repo's `agents/` directory and parses every file.
 * Invalid files are surfaced in the list with their parser error rather
 * than silently filtered — US-0.1-05 explicitly rejects "silent failure."
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

  const dir = await listDirectory(token, ref, AGENTS_DIR);
  if (!dir.ok) return { ok: false, error: dir.error, detail: dir.detail };

  // Only `.yaml` / `.yml` / `.json` files at the top level for now. Subdirs
  // are out of scope until we have a clear use case.
  const fileEntries = dir.entries.filter(
    (e) => e.type === "file" && detectFormat(e.name) !== null,
  );

  const agents = await Promise.all(
    fileEntries.map(async (entry): Promise<ListedAgent> => {
      const read = await readFile(token, ref, entry.path);
      if (!read.ok) {
        return {
          filename: entry.name,
          path: entry.path,
          format: detectFormat(entry.name),
          ok: false,
          error: "invalid-yaml", // approximate — file read failure surfaces as parse error
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
 *  - the agent (valid or invalid) if a file in agents/ parses to that name
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
    // For invalid files, fall back to filename-basename match.
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
  | ParseAgentError
  | GitHubFileError;

export type CreateAgentResult =
  | { ok: true; filename: string; path: string; commitSha: string }
  | { ok: false; error: CreateAgentError; detail?: string };

async function commitAgentFile(
  workspaceId: string,
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
  const path = `${AGENTS_DIR}/${filename}`;

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
  harness: Harness,
): Promise<CreateAgentResult> {
  if (!validateAgentName(name)) {
    return {
      ok: false,
      error: "invalid-name",
      detail: "Use 2–64 chars, lowercase letters, digits, and hyphens.",
    };
  }
  const content = renderStarter(name, harness);
  return commitAgentFile(
    workspaceId,
    `${name}.yaml`,
    content,
    `Create agent: ${name} (from starter template)`,
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
  const filename = `${parsed.spec.name}.${format === "yaml" ? "yaml" : "json"}`;
  return commitAgentFile(
    workspaceId,
    filename,
    content,
    `Create agent: ${parsed.spec.name}`,
  );
}
