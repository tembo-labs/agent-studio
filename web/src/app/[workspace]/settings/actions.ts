"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { getServerSession } from "@/lib/session";
import {
  restoreAgent,
  type RestoreAgentError,
} from "@/lib/workspace-agents";
import {
  disconnectWorkspaceRepo,
  getWorkspaceBySlug,
  removeWorkspaceSecret,
  setWorkspaceSecret,
  userIsMember,
  type SetWorkspaceSecretError,
  type WorkspaceSecretKind,
} from "@/lib/workspace";

// Keep the union narrow — only kinds the settings UI lets you manage
// land here. The repo-connect flow writes github_pat; the runtime stores
// keys through this surface only.
type SettingsKind = Extract<
  WorkspaceSecretKind,
  "tembo_api_key" | "anthropic_api_key"
>;

const SETTINGS_KIND_LABELS: Record<SettingsKind, string> = {
  tembo_api_key: "Tembo API key",
  anthropic_api_key: "Anthropic API key",
};

function isSettingsKind(v: string): v is SettingsKind {
  return v === "tembo_api_key" || v === "anthropic_api_key";
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
