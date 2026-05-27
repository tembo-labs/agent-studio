"use server";

import { notFound } from "next/navigation";

import { validateAgentName } from "@/lib/agent-format";
import { FRAMEWORKS, type Framework } from "@/lib/agent-framework";
import {
  authorizeWorkspace,
  DENIED_MESSAGE,
} from "@/lib/auth-server";
import {
  buildCreateAgentPrompt,
  createTemboTask,
  type CapError,
} from "@/lib/cap-api";
import {
  createImprovement,
  improvementMarker,
  setImprovementTask,
} from "@/lib/improvements-api";
import { getAgentByName } from "@/lib/workspace-agents";
import {
  getWorkspaceRepo,
  getWorkspaceSecretPlaintext,
} from "@/lib/workspace";

function parseFrameworkField(raw: unknown): Framework | null {
  if (typeof raw !== "string") return null;
  return (FRAMEWORKS as readonly string[]).includes(raw)
    ? (raw as Framework)
    : null;
}

// File extension + subdirectory by framework. Inlined rather than
// exported from workspace-agents.ts because the chat-to-create path
// doesn't directly commit anything — Tembo writes the file on merge
// — so we only need the path shape here.
const FRAMEWORK_PATH: Record<Framework, { dir: string; ext: "yaml" | "json" }> = {
  "pydantic-agentspec": { dir: "pydantic-agentspec", ext: "yaml" },
  "cargo-ai": { dir: "cargo-ai", ext: "json" },
};

export type ChatCreateFormState = {
  error?: string;
  success?: {
    improvementId: string;
    taskId: string;
    htmlUrl: string;
    status: string;
    agentName: string;
    agentPath: string;
  };
};

export async function createFromChatAction(
  _prev: ChatCreateFormState,
  formData: FormData,
): Promise<ChatCreateFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const framework = parseFrameworkField(formData.get("framework"));
  const description = String(formData.get("description") ?? "").trim();

  if (!validateAgentName(name)) {
    return {
      error:
        "Agent name must be 2–64 chars, lowercase letters, digits, and hyphens.",
    };
  }
  if (!framework) {
    return { error: "Pick a framework for the new agent." };
  }
  if (!description) {
    return { error: "Describe what the agent should do before submitting." };
  }

  const auth = await authorizeWorkspace(slug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    return {
      error:
        "This workspace has no GitHub repository connected. Connect one in Settings before chatting.",
    };
  }
  const apiKey = await getWorkspaceSecretPlaintext(workspace.id, "tembo_api_key");
  if (!apiKey) {
    return {
      error:
        "Tembo API key not set for this workspace. Add it in Settings → Tembo API key.",
    };
  }

  // Name-collision check against the repo's current agents. Treat
  // both parsed-OK matches (by canonical name) and parse-error
  // matches (by filename base) as taken.
  const collision = await getAgentByName(workspace.id, name);
  if (collision) {
    return {
      error:
        "An agent with this name already exists in the connected repo. Pick a different name.",
    };
  }

  const { dir, ext } = FRAMEWORK_PATH[framework];
  const agentPath = `agents/${dir}/${name}.${ext}`;

  // Persist the request as an improvement row before talking to
  // Tembo so we own the id we embed in the prompt. agent_name +
  // agent_path are the *intended* values; once the PR merges, an
  // agent at that path will satisfy them. runId is null because
  // there's no prior run to anchor against.
  const row = await createImprovement({
    workspaceId: workspace.id,
    runId: null,
    agentName: name,
    agentPath,
    improvementText: description,
    kind: "create",
    userId,
  });

  const prompt = buildCreateAgentPrompt({
    framework,
    agentName: name,
    agentPath,
    description,
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
    return { error: formatCapError(res.error) };
  }
  await setImprovementTask({
    id: row.id,
    temboTaskId: res.result.taskId,
    temboTaskHtmlUrl: res.result.htmlUrl,
  });

  return {
    success: {
      improvementId: row.id,
      taskId: res.result.taskId,
      htmlUrl: res.result.htmlUrl,
      status: res.result.status,
      agentName: name,
      agentPath,
    },
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
