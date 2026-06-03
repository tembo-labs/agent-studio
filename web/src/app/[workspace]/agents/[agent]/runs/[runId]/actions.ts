"use server";

import { notFound } from "next/navigation";

import {
  authorizeWorkspace,
  DENIED_MESSAGE,
} from "@/lib/auth-server";
import {
  buildImprovePrompt,
  createTemboTask,
  type CapError,
} from "@/lib/cap-api";
import {
  createImprovement,
  improvementMarker,
  setImprovementTask,
} from "@/lib/improvements-api";
import { getRun } from "@/lib/runs-api";
import {
  getWorkspaceRepo,
  getWorkspaceSecretPlaintext,
} from "@/lib/workspace";

export type ImproveResult =
  | {
      ok: true;
      improvementId: string;
      taskId: string;
      htmlUrl: string;
      status: string;
    }
  | { ok: false; error: string };

export async function improveAgentAction(args: {
  workspaceSlug: string;
  runId: string;
  improvement: string;
}): Promise<ImproveResult> {
  const improvement = args.improvement.trim();
  if (!improvement) {
    return { ok: false, error: "Tell us what to improve before submitting." };
  }

  const auth = await authorizeWorkspace(args.workspaceSlug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { ok: false, error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const run = await getRun(args.runId, workspace.id);
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

  // Persist the improvement row before talking to Tembo so we own
  // the id we embed in the prompt — even if the CAP call fails the
  // row exists with status='submitted' and we can retry later.
  const row = await createImprovement({
    workspaceId: workspace.id,
    runId: run.id,
    agentName: run.agentName,
    agentPath: run.agentPath,
    improvementText: improvement,
    userId,
  });

  const prompt = buildImprovePrompt({
    agentPath: run.agentPath,
    model: run.model,
    userMessage: "", // Run record doesn't capture the user message separately from the prompt; revisit when chat lands.
    output: run.output,
    improvement,
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
