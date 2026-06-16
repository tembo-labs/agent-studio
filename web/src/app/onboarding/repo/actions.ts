"use server";

import { redirect } from "next/navigation";

import { authorizeWorkspace } from "@/lib/auth-server";
import { writeAuditEvent } from "@/lib/audit-db";
import { ensureRepoReadme } from "@/lib/repo-init";
import {
  connectWorkspaceRepo,
  type ConnectWorkspaceRepoError,
} from "@/lib/workspace";

export type ConnectRepoFormState = {
  error?: string;
};

const ERROR_MESSAGES: Record<ConnectWorkspaceRepoError, string> = {
  "unparseable-repo":
    "Could not parse that repo. Try a form like github.com/owner/repo or owner/repo.",
  "missing-token": "Please paste a GitHub personal access token.",
  "invalid-token":
    "GitHub rejected that token. Check it has not been revoked or expired.",
  "not-found":
    "GitHub returned 404 — the repo doesn't exist or your token can't see it.",
  "no-push":
    "The token can read the repo but not push to it. Grant write access (classic: `repo` scope; fine-grained: Contents read+write) and try again.",
  network: "Could not reach the GitHub API. Try again in a moment.",
  "rate-limited":
    "GitHub rate-limited the validation request. Try again in a few minutes.",
};

export async function connectRepoAction(
  _prev: ConnectRepoFormState,
  formData: FormData,
): Promise<ConnectRepoFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const repo = String(formData.get("repo") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (!auth.ok) {
    if (auth.reason === "no-workspace") redirect("/onboarding");
    redirect("/");
  }
  const { workspace, userId } = auth;

  const result = await connectWorkspaceRepo(workspace.id, userId, {
    repo,
    token,
  });
  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] };
  }

  // Connecting a repo stores a GitHub PAT (a secret), so it's audit-worthy —
  // and pairs with the already-audited repo.disconnected. Never log the token.
  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "repo.connected",
    targetType: "workspace",
    targetId: null,
    agentName: null,
    payload: {
      repo: `${result.repo.owner}/${result.repo.name}`,
      defaultBranch: result.repo.defaultBranch,
    },
  });

  // Seed a workspace README on the default branch if the repo doesn't
  // already have one. Non-fatal — if the write fails (branch protection,
  // rate limit, etc.) we log and continue; the connect itself succeeded.
  const readme = await ensureRepoReadme(workspace.id, workspace.name);
  if (readme.status === "skipped") {
    console.warn(
      `repo-init: skipped README seed for ${workspace.slug}: ${readme.reason}`,
    );
  }

  redirect(`/${workspace.slug}`);
}
