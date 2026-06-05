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

// Label helpers live in a client-safe module so client components
// (Tools table, etc.) can import them without pulling the
// @composio/core SDK into the browser bundle. Re-exported here so
// existing server-side callers keep working with the same import
// path.
export {
  COMPOSIO_TOOLKIT_LABEL_OVERRIDES,
  toolkitLabel,
} from "@/lib/composio-label";

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
  // Defensive: the list call sometimes returns auth configs for *other*
  // toolkits (the toolkit filter isn't always honored for managed configs),
  // so trusting items[0] could hand back e.g. Linear's config for a Pylon
  // connect — opening the wrong provider's OAuth. Only accept a config
  // whose toolkit slug actually matches; otherwise create a fresh one.
  const wanted = toolkit.toLowerCase();
  const match = (list.items ?? []).find(
    (i) => i.toolkit?.slug?.toLowerCase() === wanted,
  );
  if (match) {
    return match.id;
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

// In-process cache so the Connections page doesn't pay several
// round trips to Composio per render. Keyed by apiKey since
// different workspaces' Composio accounts may have different
// custom-toolkit visibility. 1-hour TTL — the catalog updates
// roughly monthly, and the first visitor pays a few hundred ms
// to paginate the full list once; everyone else for the next
// hour gets it free.
//
// The cache is per-process (no Redis / disk), so container
// restarts force a refresh. That's fine: misclick → restart →
// stale state purged. Add a write-through later if catalog
// freshness becomes an active concern.
const TOOLKIT_CATALOG_TTL_MS = 60 * 60 * 1000;
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
    // @composio/core's high-level `toolkits.get()` flattens the
    // paged response to an array — pagination metadata is lost,
    // capping us at ~one page. Hit the underlying Stainless
    // client directly so we can walk `next_cursor` until exhausted.
    const rawClient = (
      c as unknown as {
        client: {
          toolkits: {
            list: (params: {
              sort_by?: string;
              managed_by?: string;
              cursor?: string;
              limit?: number;
            }) => Promise<{
              items?: Array<Record<string, unknown>>;
              next_cursor?: string | null;
            }>;
          };
        };
      }
    ).client;
    // Composio's catalog is ~1,000+ toolkits in three pages at
    // limit=500 (verified). Cap at 20 pages defensively in case a
    // future SDK regression sends us an infinite next_cursor loop.
    const all: Array<Record<string, unknown>> = [];
    let cursor: string | undefined = undefined;
    for (let page = 0; page < 20; page++) {
      const res = await rawClient.toolkits.list({
        sort_by: "alphabetically",
        managed_by: "all",
        cursor,
        limit: 500,
      });
      for (const t of res.items ?? []) all.push(t);
      cursor = res.next_cursor ?? undefined;
      if (!cursor) break;
    }
    const out: CatalogToolkit[] = [];
    for (const t of all) {
      const slug = typeof t.slug === "string" ? t.slug : null;
      const name = typeof t.name === "string" ? t.name : null;
      // Logo is under `meta.logo` after the SDK transform; older
      // SDK versions had it at the top level. Try both.
      const topLogo = typeof t.logo === "string" ? t.logo : null;
      const metaLogo =
        t.meta &&
        typeof t.meta === "object" &&
        typeof (t.meta as Record<string, unknown>).logo === "string"
          ? ((t.meta as Record<string, unknown>).logo as string)
          : null;
      if (slug) {
        out.push({
          slug,
          name: name ?? slug,
          logo: topLogo ?? metaLogo,
        });
      }
    }
    _toolkitCatalogCache.set(apiKey, {
      value: out,
      expiresAt: now + TOOLKIT_CATALOG_TTL_MS,
    });
    return out;
  } catch (e) {
    // Stays as a one-line warn so a bad/wrong workspace Composio key
    // surfaces in container logs (silent failures stranded a user on
    // an empty picker once already). Cause carries the HTTP body.
    const err = e as Error & { cause?: unknown };
    console.warn(
      `[composio] listAllToolkits failed: ${err.message}`,
      err.cause ? { cause: err.cause } : undefined,
    );
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

// ────────────────────────────────────────────────────────────────────
// Event triggers — Composio-managed event subscriptions.
//
// Concept: Composio owns the per-provider subscription complexity
// (Gmail push, Slack events, GitHub webhooks…). TAS hands them a
// (userId, trigger_type, connected_account_id, config) tuple and gets
// back a stable trigger_id. When the upstream provider produces an
// event, Composio normalizes it, HMAC-signs the payload, and POSTs
// to the single workspace-scoped webhook URL we register in their
// dashboard. The webhook handler verifies the signature, looks up the
// trigger row by trigger_id, and enqueues a run.
//
// We don't try to predict the shape of trigger_config — different
// trigger types want different fields (Gmail wants a label filter,
// Slack wants a channel id, …). The UI fetches `listTriggerTypes` +
// `getTriggerType` to render the right form per provider.

export type TriggerTypeSummary = {
  slug: string;
  /** Human-readable name from Composio (e.g., "New Gmail Message"). */
  name: string;
  /** Short description, if Composio supplies one. */
  description: string | null;
  toolkitSlug: string;
};

export type TriggerTypeDetail = TriggerTypeSummary & {
  /**
   * JSON-schema-shaped object describing the per-instance config that
   * Composio expects when we call createTrigger. Pass it untouched
   * into the form renderer; the schema language is JSON Schema draft
   * with the usual `properties` / `required` keys.
   */
  configSchema: Record<string, unknown> | null;
  /**
   * Raw payload shape Composio will send for this trigger, when
   * available. Useful for showing "what your agent will receive."
   */
  payloadSchema: Record<string, unknown> | null;
};

/**
 * List all trigger types Composio knows about for a given toolkit
 * (or all toolkits when omitted). Used by the per-agent create-
 * trigger form to populate the trigger-type dropdown.
 *
 * Paginates through `nextCursor` so users of toolkits with many
 * trigger types (Slack alone has dozens) see them all. Caps at 10
 * pages of 100 defensively.
 */
export async function listTriggerTypes(args: {
  apiKey: string;
  toolkit?: string;
}): Promise<TriggerTypeSummary[]> {
  const c = makeClient(args.apiKey);
  try {
    const out: TriggerTypeSummary[] = [];
    let cursor: string | undefined = undefined;
    for (let page = 0; page < 10; page++) {
      const res = (await c.triggers.listTypes({
        toolkits: args.toolkit ? [args.toolkit] : undefined,
        cursor,
        limit: 100,
      })) as {
        items?: Array<Record<string, unknown>>;
        nextCursor?: string | null;
      };
      for (const t of res.items ?? []) {
        const slug = typeof t.slug === "string" ? t.slug : null;
        const name = typeof t.name === "string" ? t.name : null;
        const description =
          typeof t.description === "string" ? t.description : null;
        const toolkitSlug =
          (t.toolkit as { slug?: string } | undefined)?.slug ?? "";
        if (slug) {
          out.push({
            slug,
            name: name ?? slug,
            description,
            toolkitSlug,
          });
        }
      }
      cursor = res.nextCursor ?? undefined;
      if (!cursor) break;
    }
    return out;
  } catch (e) {
    const err = e as Error;
    console.warn(`[composio] listTriggerTypes failed: ${err.message}`);
    return [];
  }
}

/**
 * Fetch one trigger type's details — needed before we render the
 * create form so we know what fields to ask for in the config.
 */
export async function getTriggerType(args: {
  apiKey: string;
  slug: string;
}): Promise<TriggerTypeDetail | null> {
  const c = makeClient(args.apiKey);
  try {
    const t = (await c.triggers.getType(args.slug)) as Record<string, unknown>;
    const slug = typeof t.slug === "string" ? t.slug : args.slug;
    const name = typeof t.name === "string" ? t.name : slug;
    const description =
      typeof t.description === "string" ? t.description : null;
    const toolkitSlug =
      (t.toolkit as { slug?: string } | undefined)?.slug ?? "";
    const configSchema = (t.config as Record<string, unknown>) ?? null;
    const payloadSchema = (t.payload as Record<string, unknown>) ?? null;
    return {
      slug,
      name,
      description,
      toolkitSlug,
      configSchema,
      payloadSchema,
    };
  } catch (e) {
    const err = e as Error;
    console.warn(`[composio] getTriggerType failed: ${err.message}`);
    return null;
  }
}

export type CreateTriggerResult = {
  /** Composio's trigger_id — store this in workspace_trigger. */
  triggerId: string;
};

/**
 * Create (subscribe) a Composio trigger instance for a specific
 * (user, connected account, trigger type). The returned trigger_id
 * is the only thing we need to cache: webhooks carry it back as the
 * primary key into our workspace_trigger table.
 */
export async function createTrigger(args: {
  apiKey: string;
  workspaceId: string;
  userId: string;
  triggerType: string;
  connectedAccountId: string;
  triggerConfig: Record<string, unknown>;
}): Promise<CreateTriggerResult> {
  const c = makeClient(args.apiKey);
  const composioUid = composioUserId(args.workspaceId, args.userId);
  const res = await c.triggers.create(composioUid, args.triggerType, {
    connectedAccountId: args.connectedAccountId,
    triggerConfig: args.triggerConfig,
  });
  return { triggerId: res.triggerId };
}

export async function deleteTrigger(args: {
  apiKey: string;
  triggerId: string;
}): Promise<boolean> {
  try {
    const c = makeClient(args.apiKey);
    await c.triggers.delete(args.triggerId);
    return true;
  } catch {
    return false;
  }
}

export async function setTriggerEnabledRemote(args: {
  apiKey: string;
  triggerId: string;
  enabled: boolean;
}): Promise<boolean> {
  try {
    const c = makeClient(args.apiKey);
    if (args.enabled) {
      await c.triggers.enable(args.triggerId);
    } else {
      await c.triggers.disable(args.triggerId);
    }
    return true;
  } catch {
    return false;
  }
}

export type VerifiedWebhook = {
  /** Composio trigger_id — our workspace_trigger lookup key. */
  triggerId: string;
  triggerSlug: string;
  toolkitSlug: string;
  /** Composite ${workspaceId}:${userId} that owns the connection. */
  composioUserId: string;
  /** Provider-shaped event payload (e.g., the Gmail message). */
  payload: Record<string, unknown>;
};

/**
 * Verify an incoming Composio webhook request and surface the parts
 * we need to dispatch a run. Throws on signature failure — callers
 * convert that to a 401. The raw body MUST be passed as the original
 * string Composio signed; deserializing it first will break the
 * HMAC check.
 */
export async function verifyTriggerWebhook(args: {
  apiKey: string;
  secret: string;
  rawBody: string;
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
}): Promise<VerifiedWebhook> {
  const c = makeClient(args.apiKey);
  const result = await c.triggers.verifyWebhook({
    id: args.webhookId,
    timestamp: args.webhookTimestamp,
    signature: args.webhookSignature,
    payload: args.rawBody,
    secret: args.secret,
  });
  const p = result.payload as {
    id: string;
    triggerSlug: string;
    toolkitSlug: string;
    userId: string;
    payload: Record<string, unknown>;
  };
  return {
    triggerId: p.id,
    triggerSlug: p.triggerSlug,
    toolkitSlug: p.toolkitSlug,
    composioUserId: p.userId,
    payload: p.payload,
  };
}
