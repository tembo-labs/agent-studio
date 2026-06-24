"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { deleteApiKey } from "@/lib/api-keys-db";
import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";
import {
  deleteNativeConnection,
  getNativeConnectionById,
  getNativeConnectionCredentials,
  listNativeConnectionsForUser,
  renameNativeConnection,
} from "@/lib/connections";
import {
  deleteToolsForConnection,
  renameToolsForConnection,
  replaceToolsForConnection,
} from "@/lib/mcp-tools";
import { getMcpProvider } from "@/lib/mcp-providers";
import { fetchNativeMcpTools } from "@/lib/native-mcp-tools";

// Server actions for native-MCP connection rows. Read-paths live on
// the page; the action surface here is just the disconnect button.
// (Authorize + callback go through dedicated route handlers under
// /api/connections/native/[provider]/…)

export type SimpleConnectionActionState = {
  message?: string;
  error?: string;
};
const EMPTY: SimpleConnectionActionState = {};

/**
 * Disconnect a user's native-MCP connection. The row's owner can
 * disconnect themselves (operator or higher); a workspace_admin can
 * disconnect anyone in the workspace — same model as the Composio
 * disconnect action.
 */
export async function disconnectNativeMcpConnectionAction(
  _prev: SimpleConnectionActionState,
  formData: FormData,
): Promise<SimpleConnectionActionState> {
  const slug = String(formData.get("workspace") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  if (!connectionId) return { error: "Missing connection id." };

  const auth = await authorizeWorkspace(slug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId, role } = auth;

  const row = await getNativeConnectionById(workspace.id, connectionId);
  if (!row) return { error: "Connection not found." };
  // Operators can only disconnect their own connections; admins can
  // disconnect anyone's. This matches the Composio side's implicit
  // model (operator-level mutate, admin-level workspace-wide).
  if (role !== "workspace_admin" && row.userId !== userId) {
    return { error: DENIED_MESSAGE };
  }

  const ok = await deleteNativeConnection(workspace.id, connectionId);
  if (!ok) return { error: "Connection no longer exists." };

  // Self-key (Tembo) rows own a minted tas_ API key — revoke it so the
  // credential can't outlive the connection. Keyed on `api_key_id` in metadata
  // (only self-key connections have it) rather than the provider slug, so a
  // renamed/defunct provider's leftover key still gets revoked.
  if (typeof row.metadata.api_key_id === "string") {
    await deleteApiKey(workspace.id, row.metadata.api_key_id);
  }

  // Drop the cached tool catalog for this slot too. A future
  // re-connect under the same name shouldn't inherit a stale list
  // — Composio + native both refresh from upstream on connect.
  await deleteToolsForConnection({
    workspaceId: workspace.id,
    userId: row.userId,
    source: "native-mcp",
    provider: row.type,
    connectionName: row.name,
  });

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "connection.disconnected",
    targetType: "connection",
    targetId: connectionId,
    agentName: null,
    payload: { provider: row.type, name: row.name, source: "native-mcp" },
  });

  revalidatePath(`/${slug}/connections`, "layout");
  // The detail page this was triggered from no longer resolves — go to the list.
  redirect(`/${slug}/connections`);
}

/**
 * Re-fetch the MCP server's tool list and update the cached row.
 * Owner of the connection (or any workspace_admin) can refresh —
 * matches the disconnect surface so a user can keep their own
 * connection healthy without admin help.
 */
export async function refreshNativeMcpToolsAction(
  _prev: SimpleConnectionActionState,
  formData: FormData,
): Promise<SimpleConnectionActionState> {
  const slug = String(formData.get("workspace") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  if (!connectionId) return { error: "Missing connection id." };

  const auth = await authorizeWorkspace(slug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId, role } = auth;

  const row = await getNativeConnectionById(workspace.id, connectionId);
  if (!row) return { error: "Connection not found." };
  if (role !== "workspace_admin" && row.userId !== userId) {
    return { error: DENIED_MESSAGE };
  }
  if (row.status !== "active") {
    return { error: `Connection is ${row.status}; reconnect first.` };
  }

  let creds;
  try {
    creds = await getNativeConnectionCredentials(connectionId);
  } catch {
    return { error: "Couldn't load stored credentials." };
  }

  try {
    const tools = await fetchNativeMcpTools(row.mcpServerUrl, creds.access_token);
    await replaceToolsForConnection({
      workspaceId: workspace.id,
      userId: row.userId,
      source: "native-mcp",
      provider: row.type,
      connectionName: row.name,
      tools: tools.map((t) => ({
        slug: t.slug,
        displayName: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  } catch (e) {
    return {
      error: `Refresh failed: ${(e as Error).message.slice(0, 160)}`,
    };
  }

  revalidatePath(`/${slug}/connections`, "layout");
  return { message: "Tools refreshed." };
}

export type RenameNativeMcpConnectionFormState = {
  message?: string;
  error?: string;
};

const RENAME_NATIVE_EMPTY: RenameNativeMcpConnectionFormState = {};

/**
 * Rename a native-MCP connection's slot label. Owner of the row
 * (operator+) can rename their own; workspace_admin can rename any.
 * Also moves cached tool rows so the (source, provider, name) tuple
 * stays consistent across workspace_connection +
 * workspace_mcp_tool. Mirrors renameComposioConnectionAction.
 */
export async function renameNativeMcpConnectionAction(
  _prev: RenameNativeMcpConnectionFormState,
  formData: FormData,
): Promise<RenameNativeMcpConnectionFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  const newName = String(formData.get("newName") ?? "");
  if (!connectionId) return { error: "Missing connection id." };

  const auth = await authorizeWorkspace(slug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId, role } = auth;

  const row = await getNativeConnectionById(workspace.id, connectionId);
  if (!row) return { error: "Connection not found." };
  if (role !== "workspace_admin" && row.userId !== userId) {
    return { error: DENIED_MESSAGE };
  }

  const result = await renameNativeConnection(
    workspace.id,
    connectionId,
    newName,
  );
  if (!result.ok) {
    switch (result.error) {
      case "bad-name-shape":
        return {
          error:
            "Name must contain only lowercase letters, digits, hyphens, or underscores.",
        };
      case "name-taken":
        return {
          error: "You already have another connection with that name.",
        };
      case "not-found":
        return { error: "Connection not found." };
    }
  }

  // Keep workspace_mcp_tool in lockstep — the (source, provider,
  // name) tuple is part of the natural key, so renaming the
  // connection without moving the tool rows would orphan them and
  // the Connections / Tools UI would show 0 tools after rename.
  await renameToolsForConnection({
    workspaceId: workspace.id,
    userId: row.userId,
    source: "native-mcp",
    provider: row.type,
    oldName: result.oldName,
    newName: result.newName,
  });

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "connection.renamed",
    targetType: "connection",
    targetId: connectionId,
    agentName: null,
    payload: {
      provider: row.type,
      old_name: result.oldName,
      new_name: result.newName,
      source: "native-mcp",
    },
  });

  revalidatePath(`/${slug}/connections`, "layout");
  return { message: "Connection renamed." };
}

/**
 * Remove the acting user's "defunct" native-MCP connections — rows whose
 * provider slug is no longer in the catalog (e.g. the old `tembo` self-key
 * connection after the rename to `tembo-agent-studio`). Those rows don't render
 * on the Connections page (no matching catalog provider) so they can't be
 * disconnected the normal way, yet they still leak into the create-agent prompt
 * and keep a minted tas_ key alive. This deletes them, revokes any self-key
 * API key, and drops their cached tools. Operator+ (own connections).
 */
export async function removeDefunctNativeConnectionsAction(
  _prev: SimpleConnectionActionState,
  formData: FormData,
): Promise<SimpleConnectionActionState> {
  const slug = String(formData.get("workspace") ?? "");
  const auth = await authorizeWorkspace(slug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const connections = await listNativeConnectionsForUser(workspace.id, userId);
  const defunct = connections.filter((c) => !getMcpProvider(c.type));
  if (defunct.length === 0) return { message: "No defunct connections to remove." };

  for (const row of defunct) {
    await deleteNativeConnection(workspace.id, row.id);
    if (typeof row.metadata.api_key_id === "string") {
      await deleteApiKey(workspace.id, row.metadata.api_key_id);
    }
    await deleteToolsForConnection({
      workspaceId: workspace.id,
      userId: row.userId,
      source: "native-mcp",
      provider: row.type,
      connectionName: row.name,
    });
    await writeAuditEvent({
      workspaceId: workspace.id,
      actorUserId: userId,
      source: "human_action",
      kind: "connection.disconnected",
      targetType: "connection",
      targetId: row.id,
      agentName: null,
      payload: { provider: row.type, name: row.name, source: "native-mcp", defunct: true },
    });
  }

  revalidatePath(`/${slug}/connections`, "layout");
  const names = defunct.map((c) => c.type).join(", ");
  return { message: `Removed ${defunct.length} defunct connection(s): ${names}.` };
}
