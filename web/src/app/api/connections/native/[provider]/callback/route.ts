import { NextResponse, type NextRequest } from "next/server";

import { writeAuditEvent } from "@/lib/audit-db";
import { saveNativeConnection } from "@/lib/connections";
import { getPublicOrigin } from "@/lib/config";
import {
  getMcpProvider,
  redirectUriFor,
  type McpProviderSlug,
} from "@/lib/mcp-providers";
import {
  noRedirectFetchInit,
  trustedOAuthUrl,
} from "@/lib/native-oauth-security";
import { fetchNativeMcpTools } from "@/lib/native-mcp-tools";
import { replaceToolsForConnection } from "@/lib/mcp-tools";
import { verifyNativeMcpState } from "@/lib/oauth-state";
import { getServerSession } from "@/lib/session";
import { userIsMember } from "@/lib/workspace";

// Native-MCP OAuth callback. The provider redirects the user back
// here with ?code=...&state=...; we swap the code for tokens at the
// token endpoint embedded in the signed state, using the PKCE
// verifier and DCR-issued client_id we squirreled away at authorize
// time. No client_secret — token_endpoint_auth_method=none + PKCE.

function back(
  slug: string,
  provider: string,
  status: "ok" | "error",
  detail?: string,
): NextResponse {
  const target = new URL(`/${slug}/connections/native-mcp`, getPublicOrigin());
  target.searchParams.set("native_mcp", provider);
  target.searchParams.set("result", status);
  if (detail) target.searchParams.set("detail", detail.slice(0, 200));
  return NextResponse.redirect(target, 302);
}

type RouteParams = Promise<{ provider: string }>;

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

  const session = await getServerSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const stateRaw = request.nextUrl.searchParams.get("state");
  if (!stateRaw) {
    return NextResponse.json({ error: "missing state" }, { status: 400 });
  }
  const state = verifyNativeMcpState(stateRaw);
  if (!state) {
    return NextResponse.json(
      { error: "state failed signature verification" },
      { status: 400 },
    );
  }
  if (state.provider !== provider.slug) {
    return NextResponse.json(
      { error: "state provider doesn't match route" },
      { status: 400 },
    );
  }
  if (session.user.id !== state.userId) {
    return back(
      state.workspaceSlug,
      provider.slug,
      "error",
      "Session user changed during OAuth flow.",
    );
  }

  const isMember = await userIsMember(state.workspaceId, session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "not a member" }, { status: 403 });
  }

  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return back(
      state.workspaceSlug,
      provider.slug,
      "error",
      `${provider.displayName} rejected the authorization: ${providerError}`,
    );
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return back(
      state.workspaceSlug,
      provider.slug,
      "error",
      `${provider.displayName} didn't return an authorization code.`,
    );
  }

  // PKCE token exchange. Public client → no client_secret. The
  // code_verifier proves we're the same party that initiated the
  // authorize request (we hold the verifier whose S256 hash we sent
  // as the challenge).
  let tokenJson: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  let tokenEndpoint: URL;
  try {
    tokenEndpoint = await trustedOAuthUrl(
      state.tokenEndpoint,
      provider,
      "Token endpoint",
    );
  } catch (e) {
    return back(
      state.workspaceSlug,
      provider.slug,
      "error",
      `Token endpoint is not trusted: ${(e as Error).message}`,
    );
  }
  try {
    const tokenRes = await fetch(tokenEndpoint, noRedirectFetchInit({
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUriFor(provider.slug as McpProviderSlug),
        client_id: state.clientId,
        code_verifier: state.pkceVerifier,
      }).toString(),
    }));
    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => "");
      return back(
        state.workspaceSlug,
        provider.slug,
        "error",
        `Token exchange failed (${tokenRes.status}): ${body.slice(0, 200)}`,
      );
    }
    tokenJson = await tokenRes.json();
  } catch (e) {
    return back(
      state.workspaceSlug,
      provider.slug,
      "error",
      `Token exchange fetch failed: ${(e as Error).message}`,
    );
  }
  if (!tokenJson.access_token) {
    return back(
      state.workspaceSlug,
      provider.slug,
      "error",
      `${provider.displayName} returned no access token.`,
    );
  }

  const expiresAt = tokenJson.expires_in
    ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
    : undefined;

  const saved = await saveNativeConnection({
    workspaceId: state.workspaceId,
    userId: state.userId,
    type: provider.slug as McpProviderSlug,
    name: state.connectionName,
    mcpServerUrl: provider.mcpServerUrl,
    authType: "oauth2",
    credentials: {
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      expires_at: expiresAt,
      scope: tokenJson.scope,
      token_type: tokenJson.token_type,
    },
    // DCR client_id stays in metadata so a future "refresh token"
    // exchange can present the same client identity. (We can also
    // re-DCR on reconnect; this is a minor optimization.)
    metadata: { dcr_client_id: state.clientId },
  });

  await writeAuditEvent({
    workspaceId: state.workspaceId,
    actorUserId: state.userId,
    source: "human_action",
    kind: "connection.authorized",
    targetType: "connection",
    targetId: saved.id,
    agentName: null,
    payload: {
      provider: provider.slug,
      name: state.connectionName,
      source: "native-mcp",
    },
  });

  // Best-effort: prime the tool-list cache so the Connections page
  // can show "N tools available" immediately. Don't block the
  // redirect on failure — the connection itself is good, and we can
  // backfill the cache later (refresh button, or lazy on first
  // render). Just log so a recurring failure is visible.
  try {
    const tools = await fetchNativeMcpTools(
      provider.mcpServerUrl,
      tokenJson.access_token,
    );
    await replaceToolsForConnection({
      workspaceId: state.workspaceId,
      userId: state.userId,
      source: "native-mcp",
      provider: provider.slug,
      connectionName: state.connectionName,
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

  return back(state.workspaceSlug, provider.slug, "ok");
}
