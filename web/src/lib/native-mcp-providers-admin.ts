import "server-only";

import { db } from "@/lib/db";
import type { McpProvider } from "@/lib/mcp-providers";

// Per-workspace enablement of native-MCP providers. A workspace admin decides
// which providers regular users see on the Connections → Native MCP page.
//
// Absence of a row is a default, not "off": DCR providers (Attio, Pylon) are on
// unless explicitly disabled — they're zero-config; manual providers (HubSpot)
// are off unless explicitly enabled, and additionally need >=1 configured OAuth
// app instance before a user can connect (resolved by the caller, which has the
// instance list). So this table only records explicit admin choices.

export async function getProviderEnableMap(
  workspaceId: string,
): Promise<Map<string, boolean>> {
  const { rows } = await db.query<{ provider: string; enabled: boolean }>(
    `SELECT provider, enabled
       FROM workspace_native_mcp_provider
      WHERE workspace_id = $1`,
    [workspaceId],
  );
  return new Map(rows.map((r) => [r.provider, r.enabled]));
}

export async function setProviderEnabled(args: {
  workspaceId: string;
  provider: string;
  enabled: boolean;
  userId: string;
}): Promise<void> {
  await db.query(
    `INSERT INTO workspace_native_mcp_provider
       (workspace_id, provider, enabled, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (workspace_id, provider)
       DO UPDATE SET enabled = EXCLUDED.enabled,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = NOW()`,
    [args.workspaceId, args.provider, args.enabled, args.userId],
  );
}

/** DCR providers default on; manual (BYO-app) providers default off. */
export function providerEnabledByDefault(provider: McpProvider): boolean {
  return provider.authMode !== "manual";
}

/** The admin toggle state (explicit row, else the default). Independent of
 *  whether a manual provider has any app instances configured. */
export function isProviderAdminEnabled(
  provider: McpProvider,
  explicit: Map<string, boolean>,
): boolean {
  const e = explicit.get(provider.slug);
  return e === undefined ? providerEnabledByDefault(provider) : e;
}
