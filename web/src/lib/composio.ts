import "server-only";

import { Composio } from "@composio/core";

// Composio-backed connection layer ("basic mode"). Composio owns the
// OAuth apps for ~250 services, holds the credentials in their vault,
// and exposes per-toolkit tools to the agent runtime. From our side
// we only need to:
//   1. Initiate a "connection link" for a (workspace, toolkit) pair —
//      yields a redirect URL we send the user to.
//   2. Cache the resulting `connectedAccountId` locally so Settings
//      can list connections without round-tripping Composio.
//   3. Delete on disconnect.
//
// The Composio API key is workspace-scoped (lives in workspace_secret
// alongside the Tembo/Anthropic/OpenAI keys) so different teams in
// one TAS deploy can use separate Composio accounts. Each function
// here takes `apiKey` explicitly — callers fetch it once via
// `getWorkspaceSecretPlaintext` and pass it through.
//
// The Composio `user_id` we pass is the workspace UUID — that's how
// Composio isolates connections across workspaces sharing one key
// (and isn't security-critical because the API key is the boundary).

// Toolkits surfaced in v0.3 basic mode. Composio supports hundreds
// more; we widen this list as authoring guidance + agent patterns
// catch up. Each slug is what Composio knows it as.
export const COMPOSIO_TOOLKITS = ["slack", "googlesheets"] as const;
export type ComposioToolkit = (typeof COMPOSIO_TOOLKITS)[number];

export const COMPOSIO_TOOLKIT_LABELS: Record<ComposioToolkit, string> = {
  slack: "Slack",
  googlesheets: "Google Sheets",
};

export function isComposioToolkit(v: string): v is ComposioToolkit {
  return (COMPOSIO_TOOLKITS as readonly string[]).includes(v);
}

function makeClient(apiKey: string): Composio {
  return new Composio({ apiKey });
}

/**
 * Find or create a Composio-managed auth config for the given toolkit
 * on the *given Composio account*. The Composio dashboard lets you
 * register your own auth configs; if none exists, we auto-create a
 * `use_composio_managed_auth` one — the baseline flow that uses
 * Composio's pre-registered OAuth apps with each provider.
 *
 * No cross-process cache because the answer is per-account and we
 * don't want to leak across workspaces. The list+create round trip
 * runs once per Connect click; that's fine.
 */
async function getOrCreateManagedAuthConfigId(
  apiKey: string,
  toolkit: ComposioToolkit,
): Promise<string> {
  const c = makeClient(apiKey);
  const list = await c.authConfigs.list({
    toolkit,
    isComposioManaged: true,
  });
  const items = list.items ?? [];
  if (items.length > 0) {
    return items[0].id;
  }

  const created = await c.authConfigs.create(toolkit, {
    type: "use_composio_managed_auth",
    name: `tas-${toolkit}`,
  });
  return created.id;
}

export type ComposioLinkResult = {
  /** Composio's connected_account id (cache this in our DB). */
  connectedAccountId: string;
  /** URL to send the user to so they can complete OAuth on Composio's domain. */
  redirectUrl: string;
  /** Which auth config Composio used; also persisted for later debugging. */
  authConfigId: string;
};

/**
 * Initiate a new connection. The returned `redirectUrl` is what we
 * send the user to; Composio handles the OAuth dance on
 * connect.composio.dev and then 302s the user to `callbackUrl` once
 * they're done.
 *
 * `allowMultiple: true` so reconnects don't fail on Composio's
 * "you already have an ACTIVE connection" guard. The callback
 * resolves "which is the new one" by ordering ACTIVE connections by
 * recency (see findLatestActiveConnection).
 */
export async function initiateConnection(args: {
  apiKey: string;
  workspaceId: string;
  toolkit: ComposioToolkit;
  callbackUrl: string;
}): Promise<ComposioLinkResult> {
  const authConfigId = await getOrCreateManagedAuthConfigId(
    args.apiKey,
    args.toolkit,
  );
  const c = makeClient(args.apiKey);
  const req = await c.connectedAccounts.link(args.workspaceId, authConfigId, {
    callbackUrl: args.callbackUrl,
    allowMultiple: true,
  });
  return {
    connectedAccountId: req.id,
    redirectUrl: req.redirectUrl ?? "",
    authConfigId,
  };
}

/**
 * Retrieve a connection's current status from Composio. Used on the
 * callback path so we only persist the connection row once Composio
 * reports it ACTIVE.
 */
export async function getConnectionStatus(args: {
  apiKey: string;
  connectedAccountId: string;
}): Promise<string | null> {
  try {
    const c = makeClient(args.apiKey);
    const conn = await c.connectedAccounts.get(args.connectedAccountId);
    return conn.status ?? null;
  } catch {
    return null;
  }
}

export type LatestConnection = {
  connectedAccountId: string;
  authConfigId: string;
  status: string;
};

/**
 * Find the most recent ACTIVE connection for a (workspaceId, toolkit)
 * pair on the given Composio account. Used on the OAuth callback
 * path — Composio doesn't pass the new connection's id back through
 * the redirect, so we look it up by the same (userId, toolkit) we
 * initiated with.
 */
export async function findLatestActiveConnection(args: {
  apiKey: string;
  workspaceId: string;
  toolkit: ComposioToolkit;
}): Promise<LatestConnection | null> {
  const c = makeClient(args.apiKey);
  const list = await c.connectedAccounts.list({
    userIds: [args.workspaceId],
    toolkitSlugs: [args.toolkit],
    statuses: ["ACTIVE"],
    limit: 5,
  });
  const items = list.items ?? [];
  if (items.length === 0) return null;
  // Composio lists connections sorted DESC by created_at by default.
  const newest = items[0];
  return {
    connectedAccountId: newest.id,
    authConfigId: newest.authConfig?.id ?? "",
    status: newest.status,
  };
}

/**
 * Revoke + delete a connection on Composio's side. Boolean return so
 * the caller can still drop the local row even if the remote revoke
 * failed (an orphan in Composio is harmless; keeping the local row
 * is worse — user thinks they're still connected).
 */
export async function deleteRemoteConnection(args: {
  apiKey: string;
  connectedAccountId: string;
}): Promise<boolean> {
  try {
    const c = makeClient(args.apiKey);
    await c.connectedAccounts.delete(args.connectedAccountId);
    return true;
  } catch {
    return false;
  }
}
