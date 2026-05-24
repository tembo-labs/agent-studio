"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { extractCargoAiRunnable } from "@/lib/agent-format";
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

  // Build the createRun payload depending on framework. Pydantic
  // agents fly their instructions string directly to the runner.
  // Cargo AI agents pass the raw JSON to the runner — the runner
  // hands it to the bundled cargo-ai CLI, which executes the action
  // graph end-to-end.
  let model: string;
  let instructions: string;
  let specJson: string | undefined;
  let framework: "pydantic-agentspec" | "cargo-ai";
  if (spec.framework === "pydantic-agentspec") {
    framework = "pydantic-agentspec";
    model = spec.model;
    instructions = spec.instructions;
  } else {
    framework = "cargo-ai";
    const extracted = extractCargoAiRunnable(spec);
    if (!extracted.ok) {
      return {
        error:
          extracted.error === "missing-model"
            ? "This Cargo AI agent has no model declared. Add `runtime_vars.model` (e.g. `openai:gpt-4o-mini`) and try again."
            : "This Cargo AI agent has no `type: \"llm\"` actions with prompts — cargo-ai needs at least one to execute.",
      };
    }
    model = extracted.runnable.model;
    // Cargo-ai-side ignores `instructions`; we still send the joined
    // prompt text so historical run rows remain readable if anything
    // logs the request payload.
    instructions = extracted.runnable.instructions;
    specJson = found.raw;
  }

  let runId: string;
  try {
    const res = await createRun({
      workspaceId: workspace.id,
      userId: session.user.id,
      agentName: spec.name,
      agentPath: found.agent.path,
      model,
      instructions,
      framework,
      specJson,
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
