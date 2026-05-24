"use server";

import { notFound } from "next/navigation";

import {
  buildImprovePrompt,
  createTemboTask,
  type CapError,
} from "@/lib/cap-api";
import { getRun } from "@/lib/runs-api";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  getWorkspaceSecretPlaintext,
  userIsMember,
} from "@/lib/workspace";

export type ImproveResult =
  | { ok: true; taskId: string; htmlUrl: string; status: string }
  | { ok: false; error: string };

export async function improveAgentAction(args: {
  workspaceSlug: string;
  runId: string;
  feedback: string;
}): Promise<ImproveResult> {
  const feedback = args.feedback.trim();
  if (!feedback) {
    return { ok: false, error: "Tell us what to improve before submitting." };
  }

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(args.workspaceSlug);
  if (!workspace) notFound();

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  const run = await getRun(args.runId);
  if (!run || run.workspaceId !== workspace.id) notFound();

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    return {
      ok: false,
      error:
        "This workspace has no GitHub repository connected. Connect one in Settings before requesting improvements.",
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

  const prompt = buildImprovePrompt({
    agentPath: run.agentPath,
    model: run.model,
    userMessage: "", // The run record doesn't currently capture the user message separately from the prompt; revisit when chat lands.
    output: run.output,
    feedback,
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

  return {
    ok: true,
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
