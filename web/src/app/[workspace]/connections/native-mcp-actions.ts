"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";
import {
  deleteNativeConnection,
  getNativeConnectionById,
} from "@/lib/connections";

// Server actions for native-MCP connection rows. Read-paths live on
// the page; the action surface here is just the disconnect button.
// (Authorize + callback go through dedicated route handlers under
// /api/connections/native/[provider]/…)

export type SimpleConnectionActionState = { error?: string };
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
  return EMPTY;
}
