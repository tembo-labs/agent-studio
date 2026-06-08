"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";
import { getMcpProvider } from "@/lib/mcp-providers";
import {
  deleteNativeOAuthClient,
  upsertNativeOAuthClient,
} from "@/lib/native-oauth-clients";

// Configure / clear the bring-your-own OAuth app for a manual Native MCP
// provider (HubSpot). Workspace-admin only — the app is shared by everyone who
// connects that provider in the workspace.

export type NativeOAuthAppState = { message?: string; error?: string };

export async function saveNativeOAuthAppAction(
  _prev: NativeOAuthAppState,
  formData: FormData,
): Promise<NativeOAuthAppState> {
  const slug = String(formData.get("workspace") ?? "");
  const provider = String(formData.get("provider") ?? "")
    .trim()
    .toLowerCase();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const clientSecret = String(formData.get("client_secret") ?? "");

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const prov = getMcpProvider(provider);
  if (!prov || prov.authMode !== "manual") {
    return { error: "This provider doesn't use a manually-configured OAuth app." };
  }
  if (!clientId) return { error: "Enter the client ID." };
  if (!clientSecret.trim()) return { error: "Enter the client secret." };

  await upsertNativeOAuthClient({
    workspaceId: workspace.id,
    provider,
    clientId,
    clientSecret,
    userId,
  });

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "native_oauth_client.set",
    targetType: "connection",
    targetId: provider,
    agentName: null,
    payload: { provider },
  });

  revalidatePath(`/${slug}/connections`, "layout");
  return { message: `Saved the ${prov.displayName} OAuth app.` };
}

export async function removeNativeOAuthAppAction(
  _prev: NativeOAuthAppState,
  formData: FormData,
): Promise<NativeOAuthAppState> {
  const slug = String(formData.get("workspace") ?? "");
  const provider = String(formData.get("provider") ?? "")
    .trim()
    .toLowerCase();

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  await deleteNativeOAuthClient(workspace.id, provider);
  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "native_oauth_client.removed",
    targetType: "connection",
    targetId: provider,
    agentName: null,
    payload: { provider },
  });

  revalidatePath(`/${slug}/connections`, "layout");
  return { message: "Removed the OAuth app. Existing connections will stop refreshing." };
}
