"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { createRun } from "@/lib/runs-api";
import { getServerSession } from "@/lib/session";
import {
  deleteAgent,
  getAgentByName,
  type DeleteAgentError,
} from "@/lib/workspace-agents";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

export type DeleteAgentFormState = {
  error?: string;
};

const ERROR_MESSAGES: Record<DeleteAgentError, string> = {
  "no-repo": "Connect a Git repository before deleting an agent.",
  "not-found": "Agent file no longer exists in the repo.",
  "invalid-token":
    "The workspace's stored GitHub token is no longer valid. Reconnect the repo in Settings.",
  "path-exists":
    "Couldn't delete — GitHub reported a conflict. Try again.",
  "branch-protected":
    "The default branch is protected. Ask an admin to relax protections, or use v0.2's chat-to-PR flow.",
  "sha-mismatch":
    "The file changed since this page loaded. Refresh and try again.",
  "rate-limited":
    "GitHub rate-limited that request. Try again in a few minutes.",
  network: "Couldn't reach GitHub. Try again in a moment.",
};

export async function deleteAgentAction(
  _prev: DeleteAgentFormState,
  formData: FormData,
): Promise<DeleteAgentFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const agentName = String(formData.get("agent") ?? "");

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  const result = await deleteAgent(workspace.id, session.user.id, agentName);
  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] };
  }
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/settings`);
  redirect(`/${slug}`);
}

export type RunNowFormState = {
  error?: string;
};

export async function runNowAction(
  _prev: RunNowFormState,
  formData: FormData,
): Promise<RunNowFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const agentName = String(formData.get("agent") ?? "");

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  // Pull the current agent definition off the repo. We pass model +
  // instructions to the Rust API as plaintext rather than having Rust
  // re-read GitHub — keeps the Rust surface focused on execution.
  const found = await getAgentByName(workspace.id, agentName);
  if (!found || !found.agent.ok) {
    return {
      error: found
        ? "This agent's definition file is invalid; fix it before running."
        : "Agent no longer exists in the connected repo.",
    };
  }
  const spec = found.agent.spec;

  // Only Pydantic AgentSpec agents are runnable in v0.1. Cargo AI parses
  // and lists fine; its runtime lands with the v0.3+ multi-framework
  // slice. The Run now button is hidden in the UI for non-Pydantic
  // frameworks, but defend the server action too.
  if (spec.framework !== "pydantic-agentspec") {
    return {
      error:
        "This framework's runtime isn't wired in v0.1. Cargo AI runs land in v0.3+ (see context/0.3/README.md).",
    };
  }

  let runId: string;
  try {
    const res = await createRun({
      workspaceId: workspace.id,
      userId: session.user.id,
      agentName: spec.name,
      agentPath: found.agent.path,
      model: spec.model,
      instructions: spec.instructions,
    });
    runId = res.runId;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Couldn't queue the run.",
    };
  }

  revalidatePath(`/${slug}/agents/${encodeURIComponent(spec.name)}`);
  redirect(
    `/${slug}/agents/${encodeURIComponent(spec.name)}/runs/${encodeURIComponent(runId)}`,
  );
}
