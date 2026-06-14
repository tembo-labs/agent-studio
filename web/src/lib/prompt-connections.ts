import "server-only";

import type { AvailableConnectionSlots } from "@/lib/cap-api";
import { listConnectionsForUser } from "@/lib/composio-connections";
import { getPublicOrigin } from "@/lib/config";
import { signForAgentsToken } from "@/lib/for-agents-token";
import { buildNativeSlots } from "@/lib/native-slots";

// The connection context the create/edit prompts hand to the Tembo Coding
// Agent (CAP): the user's authorized Composio + native-MCP slot names, plus the
// base URL and signed bearer token for this instance's /for-agents native-MCP
// tool reference. CAP reads the repo (not the TAS DB), so without this it would
// write `default` slot names and have no way to discover native tool slugs.
export type PromptConnectionContext = {
  availableSlots: AvailableConnectionSlots;
  nativeSlots: AvailableConnectionSlots;
  nativeToolsBaseUrl: string;
  nativeToolsKey: string;
};

export async function buildPromptConnectionContext(
  workspaceId: string,
  userId: string,
  nowSeconds: number,
): Promise<PromptConnectionContext> {
  const availableSlots: AvailableConnectionSlots = {};
  for (const c of await listConnectionsForUser(workspaceId, userId)) {
    if (c.status !== "ACTIVE") continue;
    (availableSlots[c.toolkit] ??= []).push(c.name);
  }
  return {
    availableSlots,
    nativeSlots: await buildNativeSlots(workspaceId, userId),
    nativeToolsBaseUrl: `${getPublicOrigin()}/for-agents`,
    nativeToolsKey: signForAgentsToken(workspaceId, userId, nowSeconds),
  };
}
