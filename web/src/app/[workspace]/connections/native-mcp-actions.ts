"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";
import {
  deleteNativeConnection,
  getNativeConnectionById,
  getNativeConnectionCredentials,
  renameNativeConnection,
} from "@/lib/connections";
import {
  deleteToolsForConnection,
  renameToolsForConnection,
  replaceToolsForConnection,
} from "@/lib/mcp-tools";
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

  revalidatePath(`/${slug}/connections`);
  return { message: "Connection disconnected." };
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
      })),
    });
  } catch (e) {
    return {
      error: `Refresh failed: ${(e as Error).message.slice(0, 160)}`,
    };
  }

  revalidatePath(`/${slug}/connections`);
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

  revalidatePath(`/${slug}/connections`);
  return { message: "Connection renamed." };
}
