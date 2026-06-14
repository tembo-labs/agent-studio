import "server-only";

import type { AvailableConnectionSlots } from "@/lib/cap-api";
import { listNativeConnectionsForUser } from "@/lib/connections";

// Build the native-MCP slot map (provider slug → authorized slot names) for the
// create-agent prompt, from the user's active native connections. Native
// connections live in a separate table from Composio and must be declared with
// `source: native-mcp`, so the prompt renders them as their own block (and
// points CAP at the per-provider tool reference for the exact slugs).
export async function buildNativeSlots(
  workspaceId: string,
  userId: string,
): Promise<AvailableConnectionSlots> {
  const connections = await listNativeConnectionsForUser(workspaceId, userId);
  const slots: AvailableConnectionSlots = {};
  for (const c of connections) {
    if (c.status !== "active") continue;
    (slots[c.type] ??= []).push(c.name);
  }
  return slots;
}
