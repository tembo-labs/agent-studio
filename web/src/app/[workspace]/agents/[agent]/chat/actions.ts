"use server";

import { notFound } from "next/navigation";

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
