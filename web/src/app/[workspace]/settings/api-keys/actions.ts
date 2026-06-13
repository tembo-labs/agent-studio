"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  setApiKeyEnabled,
} from "@/lib/api-keys-db";
import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";

// Server actions for personal API keys. Each member mints keys for THEMSELVES
// (the key acts as that user, so it inherits their live workspace role and uses
// their per-user connections). Any member can create + manage their own keys; a
// workspace_admin can additionally revoke/disable anyone's. Minting requires
// only viewer because a viewer's key can only do viewer-level things — the
// key's power is bounded by the user's live role at request time, not at mint.
//
// Modeled on agents/[agent]/webhooks-actions.ts. create returns the one-time
// token so the UI can reveal it once.

export type ApiKeyActionState = {
  message?: string;
  error?: string;
  /** Present right after create — revealed once, then gone. */
  secret?: { id: string; token: string };
};

function revalidate(slug: string) {
  revalidatePath(`/${slug}/settings/api-keys`);
}

export async function createApiKeyAction(
  _prev: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  const slug = String(formData.get("workspace") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  const auth = await authorizeWorkspace(slug, "viewer");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  if (!name) return { error: "Give the key a name." };
  if (name.length > 64) return { error: "Name must be 64 characters or fewer." };

  const { key, token } = await createApiKey({
    workspaceId: workspace.id,
    userId,
    name,
    createdBy: userId,
  });

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "api_key.created",
    targetType: "api_key",
    targetId: key.id,
    agentName: null,
    payload: { name },
  });

  revalidate(slug);
  return {
    message: `Created "${name}".`,
    secret: { id: key.id, token },
  };
}

/** Resolve a key the caller is allowed to manage: their own, or any key if the
 *  caller is a workspace_admin. Returns null if not found / not permitted. */
async function ownedKey(
  workspaceId: string,
  id: string,
  userId: string,
  isAdmin: boolean,
) {
  const keys = await listApiKeys(workspaceId);
  const key = keys.find((k) => k.id === id);
  if (!key) return null;
  if (key.userId !== userId && !isAdmin) return null;
  return key;
}

export async function toggleApiKeyAction(
  _prev: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  const slug = String(formData.get("workspace") ?? "");
  const id = String(formData.get("id") ?? "");
  const enabled = formData.get("enabled") === "true";

  const auth = await authorizeWorkspace(slug, "viewer");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId, role } = auth;

  const key = await ownedKey(workspace.id, id, userId, role === "workspace_admin");
  if (!key) return { error: "Key not found." };

  await setApiKeyEnabled(workspace.id, id, enabled);
  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: enabled ? "api_key.enabled" : "api_key.disabled",
    targetType: "api_key",
    targetId: id,
    agentName: null,
    payload: { name: key.name },
  });

  revalidate(slug);
  return { message: enabled ? "Enabled." : "Disabled." };
}

export async function deleteApiKeyAction(
  _prev: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  const slug = String(formData.get("workspace") ?? "");
  const id = String(formData.get("id") ?? "");

  const auth = await authorizeWorkspace(slug, "viewer");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId, role } = auth;

  const key = await ownedKey(workspace.id, id, userId, role === "workspace_admin");
  if (!key) return { message: "Already gone." };

  await deleteApiKey(workspace.id, id);
  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "api_key.deleted",
    targetType: "api_key",
    targetId: id,
    agentName: null,
    payload: { name: key.name },
  });

  revalidate(slug);
  return { message: `Revoked "${key.name}".` };
}
