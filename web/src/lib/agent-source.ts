import "server-only";

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

import {
  listDirectory,
  readFile,
  type GitHubContentEntry,
  type ListDirectoryResult,
  type ReadFileResult,
  type RepoRef,
} from "@/lib/github";
import { getWorkspaceRepo, getWorkspaceSecretPlaintext } from "@/lib/workspace";

// Where agent files come from. Normally a connected GitHub repo; in dev/sandbox
// a local directory (TAS_LOCAL_AGENTS_DIR) shaped like a repo root — i.e. it
// contains `agents/<framework>/…` (and optionally `skills/…`). Both expose the
// same two primitives the loader needs (listDirectory + readFile), so the
// loader is source-agnostic. Local mode is READ-ONLY: chat-authoring and
// improvements (which open PRs) still require a connected repo.
export type AgentReader = {
  listDirectory(path: string): Promise<ListDirectoryResult>;
  readFile(path: string): Promise<ReadFileResult>;
};

function githubReader(token: string, ref: RepoRef): AgentReader {
  return {
    listDirectory: (path) => listDirectory(token, ref, path),
    readFile: (path) => readFile(token, ref, path),
  };
}

// Reads from a local directory tree, returning the same result shapes as the
// GitHub reader. Paths are confined to `dir` (no traversal out of the root).
function localReader(dir: string): AgentReader {
  const root = resolve(dir);
  const safe = (p: string): string | null => {
    const full = resolve(root, p.replace(/^\/+/, ""));
    return full === root || full.startsWith(root + "/") ? full : null;
  };
  return {
    async listDirectory(path): Promise<ListDirectoryResult> {
      const full = safe(path);
      if (!full) return { ok: false, error: "not-found" };
      let dirents;
      try {
        dirents = await fs.readdir(full, { withFileTypes: true });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") {
          return { ok: true, entries: [], missing: true };
        }
        return { ok: false, error: "network", detail: (e as Error).message };
      }
      const entries: GitHubContentEntry[] = await Promise.all(
        dirents.map(async (d) => {
          const childPath = path
            ? `${path.replace(/\/+$/, "")}/${d.name}`
            : d.name;
          let size = 0;
          if (d.isFile()) {
            try {
              size = (await fs.stat(resolve(full, d.name))).size;
            } catch {
              /* best-effort size */
            }
          }
          return {
            type: d.isDirectory() ? "dir" : d.isFile() ? "file" : "symlink",
            name: d.name,
            path: childPath,
            size,
            sha: "",
            download_url: null,
          };
        }),
      );
      return { ok: true, entries };
    },
    async readFile(path): Promise<ReadFileResult> {
      const full = safe(path);
      if (!full) return { ok: false, error: "not-found" };
      try {
        const content = await fs.readFile(full, "utf8");
        return {
          ok: true,
          content,
          sha: createHash("sha1").update(content).digest("hex"),
        };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") {
          return { ok: false, error: "not-found" };
        }
        return { ok: false, error: "network", detail: (e as Error).message };
      }
    },
  };
}

/**
 * Resolve the agent file source for a workspace: the connected GitHub repo if
 * one exists, else a local samples directory when `TAS_LOCAL_AGENTS_DIR` is set
 * (dev/sandbox). Returns null when neither is available — callers treat that as
 * "no repo connected", exactly as before.
 */
export async function resolveAgentReader(
  workspaceId: string,
): Promise<AgentReader | null> {
  const repo = await getWorkspaceRepo(workspaceId);
  if (repo) {
    const token = await getWorkspaceSecretPlaintext(workspaceId, "github_pat");
    return githubReader(token, {
      owner: repo.owner,
      name: repo.name,
      branch: repo.defaultBranch,
    });
  }
  const dir = process.env.TAS_LOCAL_AGENTS_DIR?.trim();
  if (dir) return localReader(dir);
  return null;
}
