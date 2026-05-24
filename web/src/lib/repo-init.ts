import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createFile,
  readFile as ghReadFile,
  type RepoRef,
} from "@/lib/github";
import {
  getWorkspaceRepo,
  getWorkspaceSecretPlaintext,
} from "@/lib/workspace";

const TEMPLATE_REL_PATH = "src/lib/templates/repo-readme.md";

let cachedTemplate: string | null = null;

async function loadTemplate(): Promise<string> {
  if (cachedTemplate !== null) return cachedTemplate;
  // process.cwd() is `web/` in dev and `/app/` in the standalone container;
  // next.config.ts's outputFileTracingIncludes ensures the .md ships at the
  // matching relative path in both environments.
  const fullPath = join(process.cwd(), TEMPLATE_REL_PATH);
  cachedTemplate = await readFile(fullPath, "utf8");
  return cachedTemplate;
}

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export type SeedReadmeOutcome =
  | { status: "created"; commitSha: string }
  | { status: "exists" }
  | { status: "skipped"; reason: string };

/**
 * If the workspace's connected repo does not already have a README.md at
 * its root, create one from the template seeded with the workspace name.
 * Idempotent and non-fatal — repos that already have a README are left
 * alone, and any error short-circuits to `skipped` so the caller can log
 * without aborting the surrounding flow.
 */
export async function ensureRepoReadme(
  workspaceId: string,
  workspaceName: string,
): Promise<SeedReadmeOutcome> {
  const repo = await getWorkspaceRepo(workspaceId);
  if (!repo) return { status: "skipped", reason: "no-repo" };

  const token = await getWorkspaceSecretPlaintext(workspaceId, "github_pat");
  const ref: RepoRef = {
    owner: repo.owner,
    name: repo.name,
    branch: repo.defaultBranch,
  };

  // If the repo already has a README at the root, leave it alone.
  const existing = await ghReadFile(token, ref, "README.md");
  if (existing.ok) return { status: "exists" };
  // We expect `not-found` for an empty README slot; anything else (auth,
  // rate limit, network) means we can't safely conclude the README is
  // missing — bail out without writing.
  if (existing.error !== "not-found") {
    return { status: "skipped", reason: existing.error };
  }

  let template: string;
  try {
    template = await loadTemplate();
  } catch (err) {
    return {
      status: "skipped",
      reason: `template-load: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const content = render(template, { WORKSPACE_NAME: workspaceName });
  const result = await createFile(token, ref, "README.md", {
    content,
    message: "chore: initialize Tembo Agent Studio workspace README",
  });
  if (!result.ok) {
    return { status: "skipped", reason: result.error };
  }
  return { status: "created", commitSha: result.commitSha };
}
