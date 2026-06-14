import "server-only";

import type { AvailableConnectionSlots } from "@/lib/cap-api";
import { listNativeConnectionsForUser } from "@/lib/connections";
import { getMcpProvider } from "@/lib/mcp-providers";

// Build the native-MCP slot map (provider slug → authorized slot names) for the
// create-agent prompt, from the user's active native connections. Native
// connections live in a separate table from Composio and must be declared with
// `source: native-mcp`, so the prompt renders them as their own block (and
// points CAP at the per-provider tool reference for the exact slugs).
//
// Only connections whose provider is still in the catalog are surfaced. A
// provider slug that was renamed or removed (e.g. the old `tembo` self-key
// connection, now `tembo-agent-studio`) leaves an orphaned row that the
// Connections UI no longer renders — without this guard it would still leak
// into the prompt and point CAP at a defunct /for-agents page.
export async function buildNativeSlots(
  workspaceId: string,
  userId: string,
): Promise<AvailableConnectionSlots> {
  const connections = await listNativeConnectionsForUser(workspaceId, userId);
  const slots: AvailableConnectionSlots = {};
  for (const c of connections) {
    if (c.status !== "active") continue;
    if (!getMcpProvider(c.type)) continue; // defunct/renamed provider — hide it
    (slots[c.type] ??= []).push(c.name);
  }
  return slots;
}
