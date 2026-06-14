import "server-only";

import {
  type AgentConnection,
  type AgentConnectionSource,
} from "@/lib/agent-format";
import { toolkitLabel } from "@/lib/composio-label";
import { listConnectionsForUser } from "@/lib/composio-connections";
import { listNativeConnectionsForUser } from "@/lib/connections";
import { getMcpProvider } from "@/lib/mcp-providers";
import { listSecretConnections } from "@/lib/secret-connections";

// Pre-flight: which of an agent's declared connections the run's acting user
// hasn't set up. Used to BLOCK a run before it starts (the wrapper would
// otherwise fail mid-run with a traceback) and to power the sidebar's
// "Action needed" prompts. Same slot logic as web/src/app/[workspace]/layout.tsx.
//
//   - composio / native-mcp: per-(user, slot) — the acting user must have an
//     ACTIVE connection for `${toolkit}:${name}`.
//   - secret: workspace-level — a secret with that slug must exist.

export type MissingConnection = {
  toolkit: string;
  name: string;
  source: AgentConnectionSource;
  /** Human label for messages, e.g. "Slack", "Attio", "clay". */
  label: string;
};

function labelFor(toolkit: string, source: AgentConnectionSource): string {
  if (source === "native-mcp") {
    return getMcpProvider(toolkit)?.displayName ?? toolkitLabel(toolkit);
  }
  if (source === "secret") return toolkit;
  return toolkitLabel(toolkit);
}

export async function findMissingConnections(
  workspaceId: string,
  actingUserId: string,
  connections: AgentConnection[],
): Promise<MissingConnection[]> {
  if (connections.length === 0) return [];

  const [composio, native, secrets] = await Promise.all([
    listConnectionsForUser(workspaceId, actingUserId).catch(() => []),
    listNativeConnectionsForUser(workspaceId, actingUserId).catch(() => []),
    listSecretConnections(workspaceId).catch(() => []),
  ]);

  const composioSlots = new Set(
    composio.filter((c) => c.status === "ACTIVE").map((c) => `${c.toolkit}:${c.name}`),
  );
  const activeNative = native.filter((c) => c.status === "active");
  const nativeSlots = new Set(activeNative.map((c) => `${c.type}:${c.name}`));
  // How many active native connections the user has per provider. Used for the
  // single-connection slot-name fallback (mirrors build_native_mcp_toolsets):
  // an agent pins a slot by name, but users routinely have the provider under a
  // different name (e.g. `tembo` vs `default`); when there's exactly one, the
  // runtime uses it regardless of the declared name, so it isn't "missing".
  const nativeCountByProvider = new Map<string, number>();
  for (const c of activeNative) {
    nativeCountByProvider.set(c.type, (nativeCountByProvider.get(c.type) ?? 0) + 1);
  }
  const secretSlugs = new Set(secrets.map((s) => s.slug));

  const missing: MissingConnection[] = [];
  const seen = new Set<string>();
  for (const conn of connections) {
    const toolkit = conn.toolkit.trim().toLowerCase();
    const name = conn.name.trim().toLowerCase() || "default";
    if (!toolkit) continue;

    let isMissing: boolean;
    if (conn.source === "secret") {
      isMissing = !secretSlugs.has(toolkit);
    } else if (conn.source === "native-mcp") {
      isMissing =
        !nativeSlots.has(`${toolkit}:${name}`) &&
        nativeCountByProvider.get(toolkit) !== 1;
    } else {
      isMissing = !composioSlots.has(`${toolkit}:${name}`);
    }
    if (!isMissing) continue;

    const key = `${conn.source}:${toolkit}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    missing.push({
      toolkit,
      name: conn.source === "secret" ? "default" : name,
      source: conn.source,
      label: labelFor(toolkit, conn.source),
    });
  }
  return missing;
}

/** A one-line, run-now-friendly error for a missing-connection list. */
export function missingConnectionsMessage(
  missing: MissingConnection[],
  actingIsSelf: boolean,
): string {
  const labels = missing
    .map((m) => {
      const slot = m.name && m.name !== "default" ? ` (${m.name})` : "";
      return `${m.label}${slot}`;
    })
    .join(", ");
  const subject = actingIsSelf
    ? "You haven't connected"
    : "The selected member hasn't connected";
  const secretOnly = missing.every((m) => m.source === "secret");
  const where = secretOnly
    ? "Add it under Connections → Secrets"
    : "Authorize under Connections";
  return `${subject}: ${labels}. ${where}, then run again.`;
}
