"use server";

import { notFound } from "next/navigation";

import {
  authorizeWorkspace,
  DENIED_MESSAGE,
} from "@/lib/auth-server";
import {
  buildChatEditPrompt,
  createTemboTask,
  type CapError,
} from "@/lib/cap-api";
import {
  createImprovement,
  improvementMarker,
  setImprovementTask,
} from "@/lib/improvements-api";
import { createRun } from "@/lib/runs-api";
import {
  getWorkspaceRepo,
  getWorkspaceSecretPlaintext,
} from "@/lib/workspace";
import { getAgentByName } from "@/lib/workspace-agents";

export type ChatSubmitResult =
  | {
      ok: true;
      improvementId: string;
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

  const auth = await authorizeWorkspace(args.workspaceSlug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { ok: false, error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

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

  // Persist the improvement row before talking to Tembo so we own
  // the id we embed in the prompt — runId is null because chat-to-
  // edit is agent-level, not anchored to a run.
  const row = await createImprovement({
    workspaceId: workspace.id,
    runId: null,
    agentName: canonicalName,
    agentPath: agent.path,
    improvementText: text,
    userId,
  });

  const prompt = buildChatEditPrompt({
    agentPath: agent.path,
    improvement: text,
    improvementMarker: improvementMarker(row.id),
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

  await setImprovementTask({
    id: row.id,
    temboTaskId: res.result.taskId,
    temboTaskHtmlUrl: res.result.htmlUrl,
  });

  return {
    ok: true,
    improvementId: row.id,
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

  const auth = await authorizeWorkspace(args.workspaceSlug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { ok: false, error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

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

  // Same dispatch the Run-now action uses — both frameworks pass
  // the raw file bytes to the api, which hands them to the
  // appropriate subprocess wrapper (cargo-ai CLI or pydantic-ai
  // Python wrapper).
  const framework: "pydantic-agentspec" | "cargo-ai" =
    spec.framework === "pydantic-agentspec" ? "pydantic-agentspec" : "cargo-ai";

  if (framework === "cargo-ai" && !spec.model) {
    return {
      ok: false,
      error:
        "This Cargo AI agent has no model declared. Add runtime_vars.model and try again.",
    };
  }

  const model = spec.model ?? "";

  try {
    const res = await createRun({
      workspaceId: workspace.id,
      userId,
      agentName: spec.name,
      agentPath: agent.path,
      model,
      userMessage: text,
      framework,
      specContent: result.raw,
      specFormat: agent.format,
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
      return "Tembo API key not set for this workspace. Add it under Settings → Tembo Coding Agent.";
    case "http":
      if (error.status === 401 || error.status === 403) {
        return "Tembo rejected the API key (it may have been rotated or revoked). Update it under Settings → Tembo Coding Agent.";
      }
      return `POST ${error.url} → ${error.status}\n${error.body.slice(0, 600) || "(no body)"}`;
    case "network":
      return `Could not reach Tembo CAP: ${error.message}`;
  }
}
