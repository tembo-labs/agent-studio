"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";
import { getMcpProvider, type McpProviderSlug } from "@/lib/mcp-providers";
import {
  getWorkspaceSecretPreview,
  nativeMcpClientSecretKinds,
  removeWorkspaceSecret,
  setWorkspaceSecret,
} from "@/lib/workspace";

// OAuth-client config actions for native-MCP providers. workspace_admin
// only. The Composio path doesn't need this — Composio owns the OAuth
// app registration on every provider's side and we just hand off
// users to their consent screen. Native MCP means TAS itself is the
// OAuth client, and a workspace admin has to register the app with
// each provider once before any workspace member can click Connect.

export type SaveOAuthClientFormState = {
  error?: string;
  message?: string;
  fieldErrors?: Partial<Record<"clientId" | "clientSecret", string>>;
};

const EMPTY: SaveOAuthClientFormState = {};

/**
 * Save the OAuth client credentials for a native-MCP provider. Both
 * fields land in workspace_secret encrypted at rest. Audit event of
 * kind=oauth_client.configured (or .rotated when overwriting).
 */
export async function saveNativeMcpOAuthClientAction(
  _prev: SaveOAuthClientFormState,
  formData: FormData,
): Promise<SaveOAuthClientFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const providerRaw = String(formData.get("provider") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const clientSecret = String(formData.get("client_secret") ?? "").trim();

  const provider = getMcpProvider(providerRaw);
  if (!provider) {
    return { error: `Unknown provider: ${providerRaw}` };
  }

  const fieldErrors: SaveOAuthClientFormState["fieldErrors"] = {};
  if (!clientId) fieldErrors.clientId = "Client ID is required.";
  if (!clientSecret) fieldErrors.clientSecret = "Client Secret is required.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const { idKind, secretKind } = nativeMcpClientSecretKinds(provider.slug);

  // "rotated" vs "configured" decided by whether the secret pair
  // already existed. We check the preview (no decrypt) before
  // overwriting so the audit event records the right verb.
  const existingId = await getWorkspaceSecretPreview(workspace.id, idKind);

  const idResult = await setWorkspaceSecret(workspace.id, idKind, clientId);
  if (!idResult.ok) {
    return { error: `Couldn't save client ID (${idResult.error}).` };
  }
  const secretResult = await setWorkspaceSecret(
    workspace.id,
    secretKind,
    clientSecret,
  );
  if (!secretResult.ok) {
    return { error: `Couldn't save client secret (${secretResult.error}).` };
  }

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "policy_change",
    kind: existingId ? "oauth_client.rotated" : "oauth_client.configured",
    targetType: "oauth_client",
    targetId: provider.slug,
    agentName: null,
    payload: { provider: provider.slug },
  });

  revalidatePath(`/${slug}/connections`);
  return { message: `Saved ${provider.displayName} OAuth client.` };
}

/**
 * Remove a native-MCP provider's OAuth client config. Doesn't touch
 * authorized user tokens — those live in workspace_connection and
 * the admin can separately disconnect individual users.
 *
 * Use case: rotating in a new client after the provider revokes the
 * old one, or removing TAS from a provider's authorized-apps list.
 */
export async function removeNativeMcpOAuthClientAction(
  _prev: SaveOAuthClientFormState,
  formData: FormData,
): Promise<SaveOAuthClientFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const providerRaw = String(formData.get("provider") ?? "").trim();
  const provider = getMcpProvider(providerRaw);
  if (!provider) return { error: `Unknown provider: ${providerRaw}` };

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const { idKind, secretKind } = nativeMcpClientSecretKinds(provider.slug);
  await removeWorkspaceSecret(workspace.id, idKind);
  await removeWorkspaceSecret(workspace.id, secretKind);

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "policy_change",
    kind: "oauth_client.removed",
    targetType: "oauth_client",
    targetId: provider.slug,
    agentName: null,
    payload: { provider: provider.slug },
  });

  revalidatePath(`/${slug}/connections`);
  return EMPTY;
}

export type { McpProviderSlug };
