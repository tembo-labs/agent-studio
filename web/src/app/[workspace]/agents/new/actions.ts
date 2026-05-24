"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { FRAMEWORKS, type Framework } from "@/lib/agent-framework";
import { getServerSession } from "@/lib/session";
import {
  createAgentFromContent,
  createAgentFromTemplate,
  type CreateAgentError,
} from "@/lib/workspace-agents";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

function parseFrameworkField(raw: unknown): Framework | null {
  if (typeof raw !== "string") return null;
  return (FRAMEWORKS as readonly string[]).includes(raw)
    ? (raw as Framework)
    : null;
}

export type NewAgentFormState = {
  error?: string;
};

const ERROR_MESSAGES: Record<CreateAgentError, string> = {
  "no-repo": "Connect a Git repository before creating an agent.",
  "invalid-name":
    "Agent name must be 2–64 chars, lowercase letters, digits, and hyphens.",
  "name-taken":
    "An agent with this name already exists in the connected repo. Pick a different name.",
  "unsupported-extension":
    "Only .yaml, .yml, and .json agent files are supported.",
  "invalid-yaml": "Could not parse that YAML.",
  "invalid-json": "Could not parse that JSON.",
  "not-an-object":
    "Agent definition must be a top-level object.",
  "unrecognized-shape":
    "Not a recognized agent format. Pydantic AgentSpec needs `instructions`; Cargo AI needs an `actions` array.",
  "missing-name": "Agent definition is missing a `name` field.",
  "missing-model":
    "Agent definition is missing a `model` field (e.g. `anthropic:claude-sonnet-4-6`).",
  "missing-instructions":
    "Agent definition is missing an `instructions` field.",
  "missing-actions":
    "Cargo AI agent definition is missing an `actions` array.",
  "invalid-token":
    "The workspace's stored GitHub token is no longer valid. Reconnect the repo in Settings.",
  "not-found":
    "The connected repo couldn't be found. It may have been renamed or made private.",
  "path-exists":
    "An agent file with that name already exists in the repo. Pick a different name.",
  "branch-protected":
    "The default branch is protected. Slice 2 of v0.2 (chat-to-PR) will add a PR flow; for now ask an admin to relax protections or commit directly.",
  "rate-limited":
    "GitHub rate-limited that request. Try again in a few minutes.",
  network: "Couldn't reach GitHub. Try again in a moment.",
};

async function authorize(slug: string) {
  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const ok = await userIsMember(workspace.id, session.user.id);
  if (!ok) notFound();

  return workspace;
}

export async function createFromTemplateAction(
  _prev: NewAgentFormState,
  formData: FormData,
): Promise<NewAgentFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const framework = parseFrameworkField(formData.get("framework"));
  if (!framework) {
    return { error: "Pick a framework for the new agent." };
  }

  const workspace = await authorize(slug);
  const result = await createAgentFromTemplate(workspace.id, name, framework);
  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] };
  }
  revalidatePath(`/${slug}`);
  redirect(`/${slug}`);
}

export async function createFromContentAction(
  _prev: NewAgentFormState,
  formData: FormData,
): Promise<NewAgentFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const formatRaw = String(formData.get("format") ?? "");
  const content = String(formData.get("content") ?? "");

  if (formatRaw !== "yaml" && formatRaw !== "json") {
    return { error: ERROR_MESSAGES["unsupported-extension"] };
  }

  const workspace = await authorize(slug);
  const result = await createAgentFromContent(workspace.id, formatRaw, content);
  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] };
  }
  revalidatePath(`/${slug}`);
  redirect(`/${slug}`);
}
