"use server";

import { notFound } from "next/navigation";

import { extractCargoAiRunnable } from "@/lib/agent-format";
import {
  buildChatEditPrompt,
  createTemboTask,
  type CapError,
} from "@/lib/cap-api";
import {
  createFeedback,
  feedbackMarker,
  setFeedbackTask,
} from "@/lib/feedbacks-api";
import { createRun } from "@/lib/runs-api";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  getWorkspaceSecretPlaintext,
  userIsMember,
} from "@/lib/workspace";
import { getAgentByName } from "@/lib/workspace-agents";

export type ChatSubmitResult =
  | {
      ok: true;
      feedbackId: string;
      taskId: string;
      htmlUrl: string;
      status: string;
    }
  | { ok: false; error: string };

export async function chatSubmitAction(args: {
  workspaceSlug: string;
  agentName: string;
  message: string;
}): Promise<ChatSubmitResult> {
  const text = args.message.trim();
  if (!text) {
    return { ok: false, error: "Type a request before sending." };
  }

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(args.workspaceSlug);
  if (!workspace) notFound();

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  const result = await getAgentByName(workspace.id, args.agentName);
  if (!result) notFound();
  const { agent } = result;
  if (!agent.ok) {
    return {
      ok: false,
      error: `Agent file failed to parse: ${agent.error}${agent.detail ? ` — ${agent.detail}` : ""}`,
    };
  }
  const canonicalName = agent.spec.name;

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    return {
      ok: false,
      error:
        "This workspace has no GitHub repository connected. Connect one in Settings before chatting.",
    };
  }

  const apiKey = await getWorkspaceSecretPlaintext(workspace.id, "tembo_api_key");
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Tembo API key not set for this workspace. Add it in Settings → Tembo API key.",
    };
  }

  // Persist the feedback row before talking to Tembo so we own the
  // id we embed in the prompt — runId is null because chat-to-edit
  // is agent-level, not anchored to a run.
  const row = await createFeedback({
    workspaceId: workspace.id,
    runId: null,
    agentName: canonicalName,
    agentPath: agent.path,
    feedbackText: text,
    userId: session.user.id,
  });

  const prompt = buildChatEditPrompt({
    agentPath: agent.path,
    feedback: text,
    feedbackMarker: feedbackMarker(row.id),
  });

  const res = await createTemboTask({
    apiKey,
    input: {
      prompt,
      repositoryUrl: `https://github.com/${repo.owner}/${repo.name}`,
      targetBranch: repo.defaultBranch,
    },
  });

  if (!res.ok) {
    return { ok: false, error: formatCapError(res.error) };
  }

  await setFeedbackTask({
    id: row.id,
    temboTaskId: res.result.taskId,
    temboTaskHtmlUrl: res.result.htmlUrl,
  });

  return {
    ok: true,
    feedbackId: row.id,
    taskId: res.result.taskId,
    htmlUrl: res.result.htmlUrl,
    status: res.result.status,
  };
}

// "Talk to the agent" — runs the agent with the user's message
// as input. Cheap chat turn, no PR involved. The user iterates on
// the agent's behavior live, then submits a change request when
// ready (chatSubmitAction).
export type SendToAgentResult =
  | { ok: true; runId: string }
  | { ok: false; error: string };

export async function sendToAgentAction(args: {
  workspaceSlug: string;
  agentName: string;
  message: string;
}): Promise<SendToAgentResult> {
  const text = args.message.trim();
  if (!text) {
    return { ok: false, error: "Type a message before sending." };
  }

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(args.workspaceSlug);
  if (!workspace) notFound();

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  const result = await getAgentByName(workspace.id, args.agentName);
  if (!result) notFound();
  const { agent } = result;
  if (!agent.ok) {
    return {
      ok: false,
      error: `Agent file failed to parse: ${agent.error}${agent.detail ? ` — ${agent.detail}` : ""}`,
    };
  }
  const spec = agent.spec;

  // Same dispatch the Run-now action uses — Pydantic agents pass
  // their flattened instructions string; Cargo AI agents pass the
  // raw JSON which the api then hands to the bundled cargo-ai CLI.
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
        ok: false,
        error:
          extracted.error === "missing-model"
            ? "This Cargo AI agent has no model declared. Add runtime_vars.model and try again."
            : "This Cargo AI agent has no type: \"llm\" actions with prompts — cargo-ai needs at least one.",
      };
    }
    model = extracted.runnable.model;
    instructions = extracted.runnable.instructions;
    specJson = result.raw;
  }

  try {
    const res = await createRun({
      workspaceId: workspace.id,
      userId: session.user.id,
      agentName: spec.name,
      agentPath: agent.path,
      model,
      instructions,
      userMessage: text,
      framework,
      specJson,
    });
    return { ok: true, runId: res.runId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't queue the run.",
    };
  }
}

function formatCapError(error: CapError): string {
  switch (error.kind) {
    case "missing_tembo_key":
      return "Tembo API key not set for this workspace.";
    case "http":
      return `POST ${error.url} → ${error.status}\n${error.body.slice(0, 600) || "(no body)"}`;
    case "network":
      return `Could not reach Tembo CAP: ${error.message}`;
  }
}
