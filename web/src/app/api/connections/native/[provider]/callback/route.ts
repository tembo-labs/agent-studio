import { NextResponse, type NextRequest } from "next/server";

import { writeAuditEvent } from "@/lib/audit-db";
import { saveNativeConnection } from "@/lib/connections";
import { getPublicOrigin } from "@/lib/config";
import {
  getMcpProvider,
  redirectUriFor,
  type McpProviderSlug,
} from "@/lib/mcp-providers";
import { verifyNativeMcpState } from "@/lib/oauth-state";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceSecretPlaintext,
  nativeMcpClientSecretKinds,
  userIsMember,
} from "@/lib/workspace";

// OAuth callback for native-MCP providers. Provider redirects the
// user back here with ?code=...&state=...; we verify the state, swap
// the code for tokens against the provider's token endpoint, and
// store the result in workspace_connection.
//
// All redirects anchor on getPublicOrigin() so a request landing on
// the docker bind-address (0.0.0.0) gets bounced to the canonical
// host where the better-auth session cookie is valid.

function back(
  slug: string,
  provider: string,
  status: "ok" | "error",
  detail?: string,
): NextResponse {
  const target = new URL(`/${slug}/connections`, getPublicOrigin());
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

  const state = request.nextUrl.searchParams.get("state");
  if (!state) {
    return NextResponse.json({ error: "missing state" }, { status: 400 });
  }
  const payload = verifyNativeMcpState(state);
  if (!payload) {
    return NextResponse.json(
      { error: "state failed signature verification" },
      { status: 400 },
    );
  }
  if (payload.provider !== provider.slug) {
    return NextResponse.json(
      { error: "state provider doesn't match route" },
      { status: 400 },
    );
  }
  // Session user must match the user the state was signed for.
  // Defends against a different user resuming someone else's
  // half-completed OAuth flow.
  if (session.user.id !== payload.userId) {
    return back(
      payload.workspaceSlug,
      provider.slug,
      "error",
      "Session user changed during OAuth flow.",
    );
  }

  const isMember = await userIsMember(payload.workspaceId, session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "not a member" }, { status: 403 });
  }

  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return back(
      payload.workspaceSlug,
      provider.slug,
      "error",
      `${provider.displayName} rejected the authorization: ${providerError}`,
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return back(
      payload.workspaceSlug,
      provider.slug,
      "error",
      `${provider.displayName} didn't return an authorization code.`,
    );
  }

  // Exchange the code for tokens. POST x-www-form-urlencoded to the
  // provider's token endpoint with the OAuth-client credentials we
  // stored when the admin set things up.
  const { idKind, secretKind } = nativeMcpClientSecretKinds(provider.slug);
  let clientId: string;
  let clientSecret: string;
  try {
    clientId = await getWorkspaceSecretPlaintext(payload.workspaceId, idKind);
    clientSecret = await getWorkspaceSecretPlaintext(
      payload.workspaceId,
      secretKind,
    );
  } catch {
    return back(
      payload.workspaceSlug,
      provider.slug,
      "error",
      `${provider.displayName} OAuth client was removed during the flow.`,
    );
  }

  const tokenRes = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUriFor(provider.slug as McpProviderSlug),
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    return back(
      payload.workspaceSlug,
      provider.slug,
      "error",
      `Token exchange failed (${tokenRes.status}): ${body.slice(0, 200)}`,
    );
  }
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!tokenJson.access_token) {
    return back(
      payload.workspaceSlug,
      provider.slug,
      "error",
      `${provider.displayName} returned no access token.`,
    );
  }

  const expiresAt = tokenJson.expires_in
    ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
    : undefined;

  const saved = await saveNativeConnection({
    workspaceId: payload.workspaceId,
    userId: payload.userId,
    type: provider.slug as McpProviderSlug,
    name: payload.connectionName,
    mcpServerUrl: provider.mcpServerUrl,
    authType: "oauth2",
    credentials: {
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      expires_at: expiresAt,
      scope: tokenJson.scope,
      token_type: tokenJson.token_type,
    },
    metadata: {},
  });

  await writeAuditEvent({
    workspaceId: payload.workspaceId,
    actorUserId: payload.userId,
    source: "human_action",
    kind: "connection.authorized",
    targetType: "connection",
    targetId: saved.id,
    agentName: null,
    payload: {
      provider: provider.slug,
      name: payload.connectionName,
      source: "native-mcp",
    },
  });

  return back(payload.workspaceSlug, provider.slug, "ok");
}
