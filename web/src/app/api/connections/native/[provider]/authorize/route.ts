import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { authorizeWorkspace } from "@/lib/auth-server";
import { getPublicOrigin } from "@/lib/config";
import {
  getMcpProvider,
  redirectUriFor,
  type McpProviderSlug,
} from "@/lib/mcp-providers";
import {
  noRedirectFetchInit,
  trustedOAuthUrl,
  trustedProviderMcpOrigin,
} from "@/lib/native-oauth-security";
import { signNativeMcpState } from "@/lib/oauth-state";

// Native-MCP OAuth authorize handler. URL shape:
//
//   GET /api/connections/native/<provider>/authorize?workspace=<slug>&name=<slot>
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
  const nameRaw = request.nextUrl.searchParams.get("name") ?? "default";
  const connectionName = nameRaw.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(connectionName)) {
    return NextResponse.json(
      { error: `bad connection name shape: ${nameRaw}` },
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
  if (
    !asMeta.authorization_endpoint ||
    !asMeta.token_endpoint ||
    !asMeta.registration_endpoint
  ) {
    return back(
      workspace.slug,
      provider.slug,
      `${provider.displayName} authorization server is missing required endpoints.`,
    );
  }
  let authorizationEndpoint: URL;
  let tokenEndpoint: URL;
  let registrationEndpoint: URL;
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
    registrationEndpoint = await trustedOAuthUrl(
      asMeta.registration_endpoint,
      provider,
      "Registration endpoint",
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
  const useNoneAuth = (asMeta.token_endpoint_auth_methods_supported ?? []).some(
    (m) => m === "none",
  );
  if (!useNoneAuth) {
    return back(
      workspace.slug,
      provider.slug,
      `${provider.displayName} auth server requires a confidential client; TAS only supports public clients today.`,
    );
  }

  // ── Step 3: Dynamic Client Registration ─────────────────────────
  const redirectUri = redirectUriFor(provider.slug as McpProviderSlug);
  let clientId: string;
  try {
    const dcrRes = await fetch(registrationEndpoint, noRedirectFetchInit({
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
    }));
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
