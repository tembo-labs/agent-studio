import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace } from "@/lib/auth-server";
import { getPublicOrigin } from "@/lib/config";
import { createApiKey, deleteApiKey } from "@/lib/api-keys-db";
import {
  getNativeConnection,
  saveNativeConnection,
} from "@/lib/connections";
import {
  getMcpProvider,
  redirectUriFor,
  tasMcpServerUrl,
  type McpProvider,
  type McpProviderSlug,
} from "@/lib/mcp-providers";
import { fetchNativeMcpTools } from "@/lib/native-mcp-tools";
import { replaceToolsForConnection } from "@/lib/mcp-tools";
import {
  noRedirectFetchInit,
  trustedOAuthUrl,
  trustedProviderMcpOrigin,
} from "@/lib/native-oauth-security";
import {
  DEFAULT_INSTANCE,
  getNativeOAuthClientPreview,
} from "@/lib/native-oauth-clients";
import { signNativeMcpState } from "@/lib/oauth-state";

// Native-MCP OAuth authorize handler. URL shape:
//
//   DCR:    GET /api/connections/native/<provider>/authorize?workspace=<slug>&name=<slot>
//   manual: GET /api/connections/native/<provider>/authorize?workspace=<slug>&app=<instance>
//
// For manual (BYO-app) providers the connection's slot name IS the OAuth-app
// instance, so `?app=` picks which app to use AND names the connection; `?name=`
// is ignored. DCR providers use the free-typed `?name=` slot.
//
// MCP-spec auth flow — no per-provider OAuth-app setup needed:
//
//   1. Discover authorization server metadata via the MCP server's
//      /.well-known/oauth-protected-resource endpoint.
//   2. Fetch /.well-known/oauth-authorization-server from the
//      provider's auth server to get registration / authorize /
//      token endpoints + supported scopes.
//   3. Dynamic Client Registration (RFC 7591): POST our redirect URI
//      to registration_endpoint, get back a fresh client_id. Using
//      token_endpoint_auth_method=none + PKCE means no client_secret
//      is needed — we're a public client.
//   4. Generate a PKCE verifier and its S256 challenge. The verifier
//      lands in the signed state token (opaque to the provider);
//      the challenge goes in the /authorize redirect URL.
//   5. Redirect the user to authorization_endpoint with all of the
//      above + scopes from the protected-resource metadata.

function back(slug: string, provider: string, detail: string): NextResponse {
  const target = new URL(`/${slug}/connections`, getPublicOrigin());
  target.searchParams.set("native_mcp", provider);
  target.searchParams.set("result", "error");
  target.searchParams.set("detail", detail.slice(0, 200));
  return NextResponse.redirect(target, 302);
}

/**
 * Self-key connect (Tembo connecting to its own /mcp). No OAuth: mint a
 * per-user `tas_` API key, store it as the connection's bearer, and point the
 * row at TAS's own MCP server. Because the key is owned by the connecting user,
 * /mcp resolves *their* live workspace role at run time — so an agent that uses
 * this connection acts with the role of whoever the run runs as. Reconnecting
 * the same slot revokes the previously minted key so we never orphan a live
 * credential.
 */
async function connectSelfKey(
  provider: McpProvider,
  workspace: { id: string; slug: string },
  userId: string,
  connectionName: string,
): Promise<NextResponse> {
  // Capture any key minted by a prior connect on this slot — revoked after the
  // new one is stored (the saveNativeConnection upsert overwrites credentials).
  const prior = await getNativeConnection(
    workspace.id,
    userId,
    provider.slug,
    connectionName,
  );
  const priorKeyId =
    typeof prior?.metadata.api_key_id === "string"
      ? prior.metadata.api_key_id
      : null;

  const mcpUrl = tasMcpServerUrl();
  const { key, token } = await createApiKey({
    workspaceId: workspace.id,
    userId,
    name: "Tembo (native MCP)",
    createdBy: userId,
  });

  const saved = await saveNativeConnection({
    workspaceId: workspace.id,
    userId,
    type: provider.slug,
    name: connectionName,
    mcpServerUrl: mcpUrl,
    // "pat", with no token_expires_at, so the OAuth refresh sweep skips it —
    // the tas_ key doesn't expire.
    authType: "pat",
    credentials: { access_token: token },
    metadata: { api_key_id: key.id },
  });

  if (priorKeyId && priorKeyId !== key.id) {
    await deleteApiKey(workspace.id, priorKeyId);
  }

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "connection.authorized",
    targetType: "connection",
    targetId: saved.id,
    agentName: null,
    payload: { provider: provider.slug, name: connectionName, source: "native-mcp" },
  });

  // Best-effort: prime the tool-list cache so the Connections page shows the
  // TAS tool catalog immediately. Don't block the redirect on failure.
  try {
    const tools = await fetchNativeMcpTools(mcpUrl, token);
    await replaceToolsForConnection({
      workspaceId: workspace.id,
      userId,
      source: "native-mcp",
      provider: provider.slug,
      connectionName,
      tools: tools.map((t) => ({
        slug: t.slug,
        displayName: t.name,
        description: t.description,
      })),
    });
  } catch (e) {
    console.error(
      `[native-mcp/${provider.slug}] tool-cache prime failed:`,
      (e as Error).message,
    );
  }

  // Land on the new connection's detail view.
  const target = new URL(
    `/${workspace.slug}/connections/native~${saved.id}`,
    getPublicOrigin(),
  );
  target.searchParams.set("result", "ok");
  return NextResponse.redirect(target, 302);
}

type RouteParams = Promise<{ provider: string }>;

type ProtectedResourceMetadata = {
  resource?: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
};

type AuthServerMetadata = {
  authorization_endpoint?: string;
  token_endpoint?: string;
  registration_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
};

type DcrResponse = {
  client_id?: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams },
): Promise<NextResponse> {
  const { provider: providerSlug } = await params;
  const provider = getMcpProvider(providerSlug);
  if (!provider) {
    return NextResponse.json(
      { error: `Unknown native-MCP provider: ${providerSlug}` },
      { status: 404 },
    );
  }

  const slug = request.nextUrl.searchParams.get("workspace");
  if (!slug) {
    return NextResponse.json(
      { error: "workspace query param required" },
      { status: 400 },
    );
  }
  // manual (BYO-app) providers use a confidential client per app instance; DCR
  // providers self-register a public client per named slot.
  const isManual = provider.authMode === "manual";
  const slotRaw = isManual
    ? (request.nextUrl.searchParams.get("app") ?? DEFAULT_INSTANCE)
    : (request.nextUrl.searchParams.get("name") ?? DEFAULT_INSTANCE);
  // For manual providers the instance slug doubles as the connection name.
  const connectionName = slotRaw.trim().toLowerCase();
  const instance = connectionName;
  if (!/^[a-z0-9_-]+$/.test(connectionName)) {
    return NextResponse.json(
      { error: `bad ${isManual ? "app instance" : "connection name"} shape: ${slotRaw}` },
      { status: 400 },
    );
  }

  const auth = await authorizeWorkspace(slug, "operator");
  if (!auth.ok) {
    if (auth.reason === "no-session") {
      return NextResponse.redirect(new URL("/", request.url), 302);
    }
    if (auth.reason === "no-workspace") {
      return NextResponse.json(
        { error: "workspace not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "insufficient role — operator required" },
      { status: 403 },
    );
  }
  const { workspace, userId } = auth;

  // Self-key providers (Tembo → its own /mcp) skip the entire OAuth dance:
  // mint a per-user tas_ key and store it as the connection bearer.
  if (provider.authMode === "self-key") {
    return connectSelfKey(provider, workspace, userId, connectionName);
  }

  // ── Step 1: protected-resource discovery ────────────────────────
  let mcpOrigin: string;
  try {
    mcpOrigin = await trustedProviderMcpOrigin(provider);
  } catch (e) {
    return back(
      workspace.slug,
      provider.slug,
      `Provider MCP URL is not trusted: ${(e as Error).message}`,
    );
  }
  const prMetaUrl = `${mcpOrigin}/.well-known/oauth-protected-resource`;
  let prMeta: ProtectedResourceMetadata;
  try {
    const res = await fetch(
      prMetaUrl,
      noRedirectFetchInit({ headers: { Accept: "application/json" } }),
    );
    if (!res.ok) {
      return back(
        workspace.slug,
        provider.slug,
        `Couldn't discover ${provider.displayName} MCP auth metadata (${res.status}).`,
      );
    }
    prMeta = (await res.json()) as ProtectedResourceMetadata;
  } catch (e) {
    return back(
      workspace.slug,
      provider.slug,
      `Discovery fetch failed: ${(e as Error).message}`,
    );
  }
  const authServerUrlRaw = prMeta.authorization_servers?.[0];
  if (!authServerUrlRaw) {
    return back(
      workspace.slug,
      provider.slug,
      `${provider.displayName} MCP didn't advertise an authorization server.`,
    );
  }
  let authServerUrl: URL;
  try {
    authServerUrl = await trustedOAuthUrl(
      authServerUrlRaw,
      provider,
      "Authorization server URL",
    );
  } catch (e) {
    return back(
      workspace.slug,
      provider.slug,
      `Authorization server URL is not trusted: ${(e as Error).message}`,
    );
  }
  const scopes = prMeta.scopes_supported ?? [];

  // ── Step 2: authorization-server discovery ──────────────────────
  const asMetaUrl = new URL(
    "/.well-known/oauth-authorization-server",
    authServerUrl,
  );
  let asMeta: AuthServerMetadata;
  try {
    const res = await fetch(
      asMetaUrl,
      noRedirectFetchInit({ headers: { Accept: "application/json" } }),
    );
    if (!res.ok) {
      return back(
        workspace.slug,
        provider.slug,
        `Couldn't fetch authorization server metadata (${res.status}).`,
      );
    }
    asMeta = (await res.json()) as AuthServerMetadata;
  } catch (e) {
    return back(
      workspace.slug,
      provider.slug,
      `Authorization server metadata fetch failed: ${(e as Error).message}`,
    );
  }
  // "manual" providers (HubSpot) use a confidential BYO OAuth app and have no
  // registration_endpoint; "dcr" providers (Attio, Pylon) self-register a
  // public client. (isManual computed above with the slot parsing.)
  if (
    !asMeta.authorization_endpoint ||
    !asMeta.token_endpoint ||
    (!isManual && !asMeta.registration_endpoint)
  ) {
    return back(
      workspace.slug,
      provider.slug,
      `${provider.displayName} authorization server is missing required endpoints.`,
    );
  }
  // Ask for a refresh token when the provider can mint one. A server that
  // supports the `refresh_token` grant typically only ISSUES a refresh_token
  // when the client also requests the OIDC `offline_access` scope (the
  // resource's own scopes_supported rarely lists it). Without it the access
  // token expires — e.g. Dialed's ~3h — and the refresh-before-use sweep has
  // nothing to renew, so the next run 401s. Only for DCR (public) providers:
  // manual (BYO-app) providers like HubSpot use their own scope vocabulary and
  // already mint refresh tokens, so an unknown `offline_access` could break
  // their connect. Gate on the advertised grant, and never duplicate it.
  if (
    !isManual &&
    (asMeta.grant_types_supported ?? []).includes("refresh_token") &&
    !scopes.includes("offline_access")
  ) {
    scopes.push("offline_access");
  }
  let authorizationEndpoint: URL;
  let tokenEndpoint: URL;
  try {
    authorizationEndpoint = await trustedOAuthUrl(
      asMeta.authorization_endpoint,
      provider,
      "Authorization endpoint",
    );
    tokenEndpoint = await trustedOAuthUrl(
      asMeta.token_endpoint,
      provider,
      "Token endpoint",
    );
  } catch (e) {
    return back(
      workspace.slug,
      provider.slug,
      `Authorization server endpoint is not trusted: ${(e as Error).message}`,
    );
  }
  if (
    !(asMeta.code_challenge_methods_supported ?? []).some((m) => m === "S256")
  ) {
    return back(
      workspace.slug,
      provider.slug,
      `${provider.displayName} auth server doesn't support PKCE/S256 — auth flow won't complete safely.`,
    );
  }

  const redirectUri = redirectUriFor(provider.slug as McpProviderSlug);
  const authMethods = asMeta.token_endpoint_auth_methods_supported ?? [];

  // ── Step 3: obtain a client_id ──────────────────────────────────
  let clientId: string;
  if (isManual) {
    // Confidential client: require client_secret_post and use the admin-stored
    // OAuth app. The secret is added at the callback's token exchange.
    if (!authMethods.some((m) => m === "client_secret_post")) {
      return back(
        workspace.slug,
        provider.slug,
        `${provider.displayName} auth server doesn't support client_secret_post.`,
      );
    }
    const byo = await getNativeOAuthClientPreview(
      workspace.id,
      provider.slug,
      instance,
    );
    if (!byo) {
      return back(
        workspace.slug,
        provider.slug,
        `The ${provider.displayName} app "${instance}" isn't configured. An admin can add it under Connections → Native MCP → Manage providers.`,
      );
    }
    clientId = byo.clientId;
  } else {
    // Public client → Dynamic Client Registration.
    if (!authMethods.some((m) => m === "none")) {
      return back(
        workspace.slug,
        provider.slug,
        `${provider.displayName} auth server requires a confidential client; configure an OAuth app instead.`,
      );
    }
    let registrationEndpoint: URL;
    try {
      registrationEndpoint = await trustedOAuthUrl(
        asMeta.registration_endpoint as string,
        provider,
        "Registration endpoint",
      );
    } catch (e) {
      return back(
        workspace.slug,
        provider.slug,
        `Registration endpoint is not trusted: ${(e as Error).message}`,
      );
    }
    try {
      const dcrRes = await fetch(
        registrationEndpoint,
        noRedirectFetchInit({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_name: "Tembo Agent Studio",
            redirect_uris: [redirectUri],
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
          }),
        }),
      );
      if (!dcrRes.ok) {
        const body = await dcrRes.text().catch(() => "");
        return back(
          workspace.slug,
          provider.slug,
          `Dynamic client registration failed (${dcrRes.status}): ${body.slice(0, 150)}`,
        );
      }
      const dcrJson = (await dcrRes.json()) as DcrResponse;
      if (!dcrJson.client_id) {
        return back(
          workspace.slug,
          provider.slug,
          `DCR succeeded but no client_id in the response.`,
        );
      }
      clientId = dcrJson.client_id;
    } catch (e) {
      return back(
        workspace.slug,
        provider.slug,
        `DCR fetch failed: ${(e as Error).message}`,
      );
    }
  }

  // ── Step 4: PKCE verifier + S256 challenge ──────────────────────
  // Verifier: 32 bytes → 43 base64url chars. Within spec (43–128).
  const pkceVerifier = randomBytes(32).toString("base64url");
  const pkceChallenge = createHash("sha256")
    .update(pkceVerifier)
    .digest("base64url");

  // ── Step 5: sign state + redirect ───────────────────────────────
  const state = signNativeMcpState({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    userId,
    provider: provider.slug,
    connectionName,
    pkceVerifier,
    clientId,
    tokenEndpoint: tokenEndpoint.toString(),
    authMode: isManual ? "manual" : "dcr",
    ...(isManual ? { instance } : {}),
  });

  const authorizeUrl = new URL(authorizationEndpoint);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  if (scopes.length > 0) {
    authorizeUrl.searchParams.set("scope", scopes.join(" "));
  }
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", pkceChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(authorizeUrl.toString(), 302);
}
