"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";
import { getMcpProvider } from "@/lib/mcp-providers";
import { setProviderEnabled } from "@/lib/native-mcp-providers-admin";
import {
  deleteNativeOAuthClient,
  upsertNativeOAuthClient,
} from "@/lib/native-oauth-clients";

// Admin config for Native MCP: enable/disable providers, and register the
// bring-your-own OAuth app instances for manual providers (HubSpot). A provider
// can have more than one app instance — each instance is shared by everyone who
// connects that instance in the workspace. Workspace-admin only.

export type NativeOAuthAppState = { message?: string; error?: string };

const INSTANCE_SHAPE = /^[a-z0-9_-]+$/;

export async function saveNativeOAuthAppAction(
  _prev: NativeOAuthAppState,
  formData: FormData,
): Promise<NativeOAuthAppState> {
  const slug = String(formData.get("workspace") ?? "");
  const provider = String(formData.get("provider") ?? "")
    .trim()
    .toLowerCase();
  const instance =
    String(formData.get("instance") ?? "default")
      .trim()
      .toLowerCase() || "default";
  const label = String(formData.get("label") ?? "").trim() || null;
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
    return {
      error: "This provider doesn't use a manually-configured OAuth app.",
    };
  }
  if (!INSTANCE_SHAPE.test(instance)) {
    return {
      error: "App name must be lowercase letters, numbers, hyphens or underscores.",
    };
  }
  if (!clientId) return { error: "Enter the client ID." };
  if (!clientSecret.trim()) return { error: "Enter the client secret." };

  await upsertNativeOAuthClient({
    workspaceId: workspace.id,
    provider,
    instance,
    label,
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
    targetId: `${provider}:${instance}`,
    agentName: null,
    payload: { provider, instance },
  });

  revalidatePath(`/${slug}/connections`, "layout");
  return { message: `Saved the ${prov.displayName} app "${instance}".` };
}

export async function removeNativeOAuthAppAction(
  _prev: NativeOAuthAppState,
  formData: FormData,
): Promise<NativeOAuthAppState> {
  const slug = String(formData.get("workspace") ?? "");
  const provider = String(formData.get("provider") ?? "")
    .trim()
    .toLowerCase();
  const instance =
    String(formData.get("instance") ?? "default")
      .trim()
      .toLowerCase() || "default";

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  await deleteNativeOAuthClient(workspace.id, provider, instance);
  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "native_oauth_client.removed",
    targetType: "connection",
    targetId: `${provider}:${instance}`,
    agentName: null,
    payload: { provider, instance },
  });

  revalidatePath(`/${slug}/connections`, "layout");
  return {
    message: `Removed the "${instance}" app. Its connections will stop refreshing.`,
  };
}

export async function setProviderEnabledAction(
  _prev: NativeOAuthAppState,
  formData: FormData,
): Promise<NativeOAuthAppState> {
  const slug = String(formData.get("workspace") ?? "");
  const provider = String(formData.get("provider") ?? "")
    .trim()
    .toLowerCase();
  const enabled = String(formData.get("enabled") ?? "") === "true";

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const prov = getMcpProvider(provider);
  if (!prov) return { error: "Unknown provider." };

  await setProviderEnabled({
    workspaceId: workspace.id,
    provider,
    enabled,
    userId,
  });

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: enabled ? "native_mcp_provider.enabled" : "native_mcp_provider.disabled",
    targetType: "connection",
    targetId: provider,
    agentName: null,
    payload: { provider, enabled },
  });

  revalidatePath(`/${slug}/connections`, "layout");
  return {
    message: `${prov.displayName} ${enabled ? "enabled" : "disabled"} for this workspace.`,
  };
}
