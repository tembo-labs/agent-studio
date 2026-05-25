"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { getServerSession } from "@/lib/session";
import {
  refreshAllGuidanceFiles,
  restoreAgent,
  type RestoreAgentError,
} from "@/lib/workspace-agents";
import {
  DEFAULT_FAVICON_KINDS,
  disconnectWorkspaceRepo,
  getWorkspaceBySlug,
  removeWorkspaceSecret,
  setFaviconCustom,
  setFaviconDefault,
  setWorkspaceSecret,
  userIsMember,
  type FaviconKind,
  type SetFaviconError,
  type SetWorkspaceSecretError,
  type WorkspaceSecretKind,
} from "@/lib/workspace";

// Keep the union narrow — only kinds the settings UI lets you manage
// land here. The repo-connect flow writes github_pat; the runtime stores
// keys through this surface only.
type SettingsKind = Extract<
  WorkspaceSecretKind,
  "tembo_api_key" | "anthropic_api_key" | "openai_api_key"
>;

const SETTINGS_KIND_LABELS: Record<SettingsKind, string> = {
  tembo_api_key: "Tembo API key",
  anthropic_api_key: "Anthropic API key",
  openai_api_key: "OpenAI API key",
};

function isSettingsKind(v: string): v is SettingsKind {
  return (
    v === "tembo_api_key" ||
    v === "anthropic_api_key" ||
    v === "openai_api_key"
  );
}

export type SecretFormState = {
  message?: string;
  error?: string;
};

function saveErrorMessage(
  kind: SettingsKind,
  err: SetWorkspaceSecretError,
): string {
  const label = SETTINGS_KIND_LABELS[kind];
  switch (err) {
    case "empty":
      return `Please paste your ${label}.`;
    case "too-short":
      return `That key looks too short to be a ${label}.`;
    case "too-long":
      return `That key is longer than we expected. Double-check what you pasted.`;
  }
}

async function authorizeWorkspace(slug: string) {
  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const ok = await userIsMember(workspace.id, session.user.id);
  if (!ok) notFound();

  return workspace;
}

export async function saveSecretAction(
  _prev: SecretFormState,
  formData: FormData,
): Promise<SecretFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const apiKey = String(formData.get("apiKey") ?? "");

  if (!isSettingsKind(kindRaw)) {
    return { error: "Unsupported secret kind." };
  }
  const kind: SettingsKind = kindRaw;

  const workspace = await authorizeWorkspace(slug);
  const result = await setWorkspaceSecret(workspace.id, kind, apiKey);
  if (!result.ok) {
    return { error: saveErrorMessage(kind, result.error) };
  }

  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}`);
  return { message: `${SETTINGS_KIND_LABELS[kind]} saved.` };
}

export async function removeSecretAction(
  _prev: SecretFormState,
  formData: FormData,
): Promise<SecretFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");

  if (!isSettingsKind(kindRaw)) {
    return { error: "Unsupported secret kind." };
  }
  const kind: SettingsKind = kindRaw;

  const workspace = await authorizeWorkspace(slug);
  await removeWorkspaceSecret(workspace.id, kind);

  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}`);
  return { message: `${SETTINGS_KIND_LABELS[kind]} removed.` };
}

export type DisconnectRepoFormState = {
  message?: string;
};

export type RestoreAgentFormState = {
  message?: string;
  error?: string;
};

const RESTORE_ERROR_MESSAGES: Record<RestoreAgentError, string> = {
  "no-repo": "Connect a Git repository before restoring an agent.",
  "not-found": "That deletion record no longer exists.",
  "already-restored": "Already restored.",
  "invalid-token":
    "The workspace's stored GitHub token is no longer valid. Reconnect the repo in Settings.",
  "path-exists":
    "An agent with the same filename exists. Delete or rename the live one first.",
  "branch-protected":
    "The default branch is protected. Ask an admin to relax protections or use v0.2's chat-to-PR flow.",
  "rate-limited":
    "GitHub rate-limited that request. Try again in a few minutes.",
  network: "Couldn't reach GitHub. Try again in a moment.",
};

export async function restoreAgentAction(
  _prev: RestoreAgentFormState,
  formData: FormData,
): Promise<RestoreAgentFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const deletionId = String(formData.get("deletionId") ?? "");

  const session = await getServerSession();
  if (!session) return { error: "Not signed in." };

  const workspace = await authorizeWorkspace(slug);
  const result = await restoreAgent(workspace.id, session.user.id, deletionId);
  if (!result.ok) {
    return { error: RESTORE_ERROR_MESSAGES[result.error] };
  }
  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}`);
  return { message: `Restored ${result.agentName}.` };
}

export type FaviconFormState = {
  message?: string;
  error?: string;
};

const FAVICON_ERROR_MESSAGES: Record<SetFaviconError, string> = {
  "no-workspace": "Workspace not found.",
  empty: "Pick a file to upload.",
  "too-large":
    "Favicons must be 200 KB or smaller. Compress the image and try again.",
  "unsupported-mime":
    "Use PNG, SVG, or ICO. Other formats aren't supported for favicons.",
};

function isDefaultFaviconKind(
  v: string,
): v is Exclude<FaviconKind, "custom"> {
  return (DEFAULT_FAVICON_KINDS as readonly string[]).includes(v);
}

export async function setFaviconDefaultAction(
  _prev: FaviconFormState,
  formData: FormData,
): Promise<FaviconFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  if (!isDefaultFaviconKind(kindRaw)) {
    return { error: "Unknown favicon kind." };
  }

  const workspace = await authorizeWorkspace(slug);
  const result = await setFaviconDefault(workspace.id, kindRaw);
  if (!result.ok) {
    return { error: FAVICON_ERROR_MESSAGES[result.error] };
  }
  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}`);
  return { message: "Favicon updated." };
}

export async function uploadFaviconAction(
  _prev: FaviconFormState,
  formData: FormData,
): Promise<FaviconFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: FAVICON_ERROR_MESSAGES.empty };
  }

  const workspace = await authorizeWorkspace(slug);
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await setFaviconCustom(workspace.id, {
    bytes: buffer,
    mime: file.type || "application/octet-stream",
  });
  if (!result.ok) {
    return { error: FAVICON_ERROR_MESSAGES[result.error] };
  }
  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}`);
  return { message: "Custom favicon uploaded." };
}

export async function disconnectRepoAction(
  _prev: DisconnectRepoFormState,
  formData: FormData,
): Promise<DisconnectRepoFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const workspace = await authorizeWorkspace(slug);
  await disconnectWorkspaceRepo(workspace.id);

  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}`);
  return { message: "Repository disconnected." };
}

export type SyncGuidanceFormState = {
  message?: string;
  error?: string;
};

// Manual trigger for refreshAllGuidanceFiles. Used by the "Sync
// agent guidance" button in Settings so a workspace whose agents
// were hand-committed (and therefore never went through the agent-
// creation bootstrap) can get the guidance files written in one
// click. Idempotent — safe to click repeatedly.
export async function syncGuidanceAction(
  _prev: SyncGuidanceFormState,
  formData: FormData,
): Promise<SyncGuidanceFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const workspace = await authorizeWorkspace(slug);
  const result = await refreshAllGuidanceFiles(workspace.id);
  if (!result.ok) {
    if (result.error === "no-repo") {
      return { error: "Connect a Git repository first." };
    }
    return { error: result.error };
  }
  return {
    message:
      "Synced agents/AGENTS.md and the per-framework AGENT_GUIDE.md files. Check the repo for new commits.",
  };
}
