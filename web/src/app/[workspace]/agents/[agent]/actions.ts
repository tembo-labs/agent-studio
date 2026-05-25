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
  // Optional user input. Empty preserves the prior behavior (a "no
  // input" run that just exercises the agent's instructions).
  const userMessage = String(formData.get("user_message") ?? "");

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  // Pull the current agent definition off the repo. Both frameworks
  // are now passthrough — the runner gets the raw file bytes plus
  // the format so the right subprocess wrapper can parse them.
  const found = await getAgentByName(workspace.id, agentName);
  if (!found || !found.agent.ok) {
    return {
      error: found
        ? "This agent's definition file is invalid; fix it before running."
        : "Agent no longer exists in the connected repo.",
    };
  }
  const spec = found.agent.spec;
  const fileFormat = found.agent.format;

  const framework: "pydantic-agentspec" | "cargo-ai" =
    spec.framework === "pydantic-agentspec" ? "pydantic-agentspec" : "cargo-ai";

  if (framework === "cargo-ai" && !spec.model) {
    return {
      error:
        "This Cargo AI agent has no model declared. Add `runtime_vars.model` (e.g. `openai:gpt-4o-mini`) and try again.",
    };
  }

  const model = spec.model ?? "";

  let runId: string;
  try {
    const res = await createRun({
      workspaceId: workspace.id,
      userId: session.user.id,
      agentName: spec.name,
      agentPath: found.agent.path,
      model,
      framework,
      specContent: found.raw,
      specFormat: fileFormat,
      userMessage,
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
