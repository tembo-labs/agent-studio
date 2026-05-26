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
// Composio's `user_id` is now `${workspaceId}:${userId}` — a
// composite. Connections are per-user (each workspace member
// authorizes their own toolkits), so the isolation boundary is
// (workspace, user), not just workspace. Including the workspaceId
// keeps Composio's vault from leaking across workspaces even when
// the same TAS user is a member of more than one.
//
// Each TAS workspace_composio_connection row also carries a `name`
// ("default", "work", "personal") so a user can attach multiple
// Gmail accounts and the agent's `connections:` field disambiguates
// by name. The connection's Composio-side connected_account_id is
// what we cache locally.

// Composio toolkit identifiers are free-form strings — whatever
// Composio's catalog uses (slack, googlesheets, gmail, notion,
// github, …). TAS doesn't maintain an allowlist; agents declare
// what they need in `connections:`, the Settings UI surfaces a
// Connect button for each, and Composio's API rejects unknown
// slugs at link time. Older versions of this file pinned the list
// to a v0.3 starter set; that constraint actively blocked Tembo
// from inventing new connections for legitimate use cases (e.g.
// an agent that reads email needed `gmail`).
export type ComposioToolkit = string;

// Curated display labels for the toolkits we surface most often.
// Falls back to a title-cased slug for anything not in the table
// (see toolkitLabel below). Exported so the Settings → Connections
// "Add another" form can populate its toolkit autocomplete from the
// same source of truth.
export const COMPOSIO_TOOLKIT_LABEL_OVERRIDES: Record<string, string> = {
  slack: "Slack",
  googlesheets: "Google Sheets",
  gmail: "Gmail",
  googlecalendar: "Google Calendar",
  googledrive: "Google Drive",
  googledocs: "Google Docs",
  notion: "Notion",
  github: "GitHub",
  linear: "Linear",
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  airtable: "Airtable",
  asana: "Asana",
  jira: "Jira",
};

export function toolkitLabel(slug: string): string {
  const override = COMPOSIO_TOOLKIT_LABEL_OVERRIDES[slug.toLowerCase()];
  if (override) return override;
  // Fallback: title-case the slug. "gmail" → "Gmail", "google_sheets"
  // → "Google Sheets". Composio slugs are usually lowercase + no
  // separator, so this is approximate; users can ask us to add an
  // override entry if a slug renders ugly.
  return slug
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function makeClient(apiKey: string): Composio {
  return new Composio({ apiKey });
}

/**
 * Compose the Composio user_id we hand to the SDK from our
 * (workspaceId, userId) pair. Composite-keying with the workspace
 * ensures one TAS user who belongs to multiple workspaces keeps
 * their connections cleanly separated on Composio's side.
 */
export function composioUserId(workspaceId: string, userId: string): string {
  return `${workspaceId}:${userId}`;
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
  userId: string;
  toolkit: ComposioToolkit;
  callbackUrl: string;
}): Promise<ComposioLinkResult> {
  const authConfigId = await getOrCreateManagedAuthConfigId(
    args.apiKey,
    args.toolkit,
  );
  const c = makeClient(args.apiKey);
  const composioUid = composioUserId(args.workspaceId, args.userId);
  const req = await c.connectedAccounts.link(composioUid, authConfigId, {
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
  userId: string;
  toolkit: ComposioToolkit;
}): Promise<LatestConnection | null> {
  const c = makeClient(args.apiKey);
  const composioUid = composioUserId(args.workspaceId, args.userId);
  const list = await c.connectedAccounts.list({
    userIds: [composioUid],
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

export type CatalogToolkit = {
  slug: string;
  /** Display name from Composio (e.g. "Google Sheets"). */
  name: string;
  /**
   * Toolkit logo URL from Composio (e.g.
   * `https://logos.composio.dev/api/gmail`). Null if the response
   * didn't carry one — UI falls back to no-icon rendering.
   */
  logo: string | null;
};

// Small in-process cache so the Connections page doesn't pay 1-3
// round trips to Composio on every render. Keyed by apiKey since
// different workspaces' Composio accounts may have different
// custom-toolkit visibility. 5-minute TTL is generous — the
// catalog updates roughly monthly and is otherwise stable.
const TOOLKIT_CATALOG_TTL_MS = 5 * 60 * 1000;
const _toolkitCatalogCache = new Map<
  string,
  { value: CatalogToolkit[]; expiresAt: number }
>();

/**
 * Fetch Composio's full toolkit catalog (alphabetized). Paginates
 * up to ~5 pages of 500 to cover the catalog without looping
 * forever on a buggy response. Returns [] on failure — callers
 * treat that as "datalist is empty, fall back to free-text entry."
 */
export async function listAllToolkits(
  apiKey: string,
): Promise<CatalogToolkit[]> {
  const now = Date.now();
  const cached = _toolkitCatalogCache.get(apiKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  try {
    const c = makeClient(apiKey);
    const out: CatalogToolkit[] = [];
    let cursor: string | undefined = undefined;
    for (let page = 0; page < 5; page++) {
      // `toolkits.get` is overloaded (slug → single, params → list).
      // Cast to the list-shape so TS picks the right branch.
      const res = (await c.toolkits.get({
        sortBy: "alphabetically",
        managedBy: "all",
        cursor,
        limit: 500,
      })) as {
        items?: {
          slug?: string;
          name?: string;
          meta?: { logo?: string };
          logo?: string;
        }[];
        nextCursor?: string;
      };
      for (const t of res.items ?? []) {
        if (t.slug) {
          // SDK has shifted the logo location across versions —
          // top-level on some, under `meta` on others. Read both.
          const logo = t.logo ?? t.meta?.logo ?? null;
          out.push({
            slug: t.slug,
            name: t.name ?? t.slug,
            logo,
          });
        }
      }
      cursor = res.nextCursor ?? undefined;
      if (!cursor) break;
    }
    _toolkitCatalogCache.set(apiKey, {
      value: out,
      expiresAt: now + TOOLKIT_CATALOG_TTL_MS,
    });
    return out;
  } catch {
    return [];
  }
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
