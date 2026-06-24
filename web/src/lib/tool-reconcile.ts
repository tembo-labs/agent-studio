import "server-only";

// Refresh every connection's cached tool catalog (the workspace_mcp_tool table
// that powers the Tools tab + the /for-agents reference) without anyone clicking
// "Refresh". Two triggers, one throttled path:
//   - on boot (every deploy starts a fresh process) — picks up tembo-agent-studio
//     tool/schema changes shipped in the release, and re-syncs everything;
//   - daily via the scheduler — catches external/Composio tools that change
//     server-side between deploys.
// A short DB-stamped throttle stops crash-loop restarts from re-running it every
// few seconds, while still letting any real deploy (minutes+ apart) refresh.
//
// Best-effort: a single connection that fails (expired token, provider down,
// missing key) is logged and skipped — it never blocks boot or the other
// connections. Reuses the exact internals the per-connection Refresh buttons use.

import {
  getNativeConnectionCredentials,
  listAllActiveNativeConnections,
} from "@/lib/connections";
import { listAllActiveComposioConnections } from "@/lib/composio-connections";
import { fetchNativeMcpTools } from "@/lib/native-mcp-tools";
import { fetchComposioToolkitTools } from "@/lib/composio-tools";
import { replaceToolsForConnection } from "@/lib/mcp-tools";
import { getWorkspaceSecretPlaintext } from "@/lib/workspace";
import {
  getLastToolReconcileAt,
  markToolReconcile,
} from "@/lib/instance-settings";

type Tally = { ok: number; failed: number };

// In-process guard so two triggers (boot + a scheduler tick) can't run the
// batch concurrently.
let inFlight = false;

/** True when a reconcile stamped `last` is recent enough to skip given `maxAgeMs`.
 *  Pure for testability. */
export function isReconcileThrottled(
  last: Date | null,
  now: number,
  maxAgeMs: number,
): boolean {
  return last !== null && now - last.getTime() < maxAgeMs;
}

/** Re-introspect + re-cache every active native-MCP and Composio connection.
 *  Returns per-substrate ok/failed tallies. Never throws on a single
 *  connection's failure. */
export async function reconcileAllToolCaches(): Promise<{
  native: Tally;
  composio: Tally;
}> {
  const native: Tally = { ok: 0, failed: 0 };
  const composio: Tally = { ok: 0, failed: 0 };

  for (const c of await listAllActiveNativeConnections()) {
    try {
      const creds = await getNativeConnectionCredentials(c.id);
      const tools = await fetchNativeMcpTools(c.mcpServerUrl, creds.access_token);
      await replaceToolsForConnection({
        workspaceId: c.workspaceId,
        userId: c.userId,
        source: "native-mcp",
        provider: c.type,
        connectionName: c.name,
        tools: tools.map((t) => ({
          slug: t.slug,
          displayName: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
      native.ok++;
    } catch (e) {
      native.failed++;
      console.warn(
        `[tool-reconcile] native ${c.type}/${c.name} (ws ${c.workspaceId}) failed:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  // One Composio API key per workspace — fetch it once and reuse across that
  // workspace's connections.
  const keyByWorkspace = new Map<string, string | null>();
  for (const c of await listAllActiveComposioConnections()) {
    try {
      let apiKey = keyByWorkspace.get(c.workspaceId);
      if (apiKey === undefined) {
        apiKey = await getWorkspaceSecretPlaintext(
          c.workspaceId,
          "composio_api_key",
        );
        keyByWorkspace.set(c.workspaceId, apiKey);
      }
      if (!apiKey) {
        // No workspace Composio key — can't introspect; leave the cache as-is.
        composio.failed++;
        continue;
      }
      const tools = await fetchComposioToolkitTools(apiKey, c.toolkit);
      await replaceToolsForConnection({
        workspaceId: c.workspaceId,
        userId: c.userId,
        source: "composio",
        provider: c.toolkit,
        connectionName: c.name,
        tools: tools.map((t) => ({
          slug: t.slug,
          displayName: t.name,
          description: t.description,
        })),
      });
      composio.ok++;
    } catch (e) {
      composio.failed++;
      console.warn(
        `[tool-reconcile] composio ${c.toolkit}/${c.name} (ws ${c.workspaceId}) failed:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  return { native, composio };
}

/** Run a reconcile unless one ran within `maxAgeMs` (or one is in flight).
 *  Stamps the completion time so the next trigger throttles off it. */
export async function maybeReconcileToolCaches(maxAgeMs: number): Promise<void> {
  if (inFlight) return;
  if (isReconcileThrottled(await getLastToolReconcileAt(), Date.now(), maxAgeMs)) {
    return;
  }
  inFlight = true;
  try {
    const { native, composio } = await reconcileAllToolCaches();
    await markToolReconcile(new Date());
    console.log(
      `[tool-reconcile] done — native ${native.ok} ok / ${native.failed} failed, ` +
        `composio ${composio.ok} ok / ${composio.failed} failed`,
    );
  } catch (e) {
    console.error("[tool-reconcile] batch threw", e);
  } finally {
    inFlight = false;
  }
}
