import { NextResponse, type NextRequest } from "next/server";

import { authorizeWorkspace } from "@/lib/auth-server";
import { getPublicOrigin } from "@/lib/config";
import {
  getMcpProvider,
  redirectUriFor,
  type McpProviderSlug,
} from "@/lib/mcp-providers";
import { signNativeMcpState } from "@/lib/oauth-state";
import {
  getWorkspaceSecretPlaintext,
  getWorkspaceSecretPreview,
  nativeMcpClientSecretKinds,
} from "@/lib/workspace";

// OAuth authorize handler for native-MCP providers. URL shape:
//
//   GET /api/connections/native/<provider>/authorize?workspace=<slug>&name=<slot>
//
// Flow:
//   1. Validate provider against the MCP_PROVIDERS catalog.
//   2. Require workspace_admin to have configured the OAuth client
//      first (their client_id + client_secret in workspace_secret).
//      Until then the row's Connect button is hidden in the UI;
//      this server check is the contract.
//   3. Authorize the requesting user as operator+ (matches Composio
//      authorize) — connecting your own slot is content editing.
//   4. Sign state with user identity + provider + connection name.
//   5. Redirect to provider.authorizeUrl with scopes + redirect URI.

function back(slug: string, provider: string, detail: string): NextResponse {
  const target = new URL(`/${slug}/connections`, getPublicOrigin());
  target.searchParams.set("native_mcp", provider);
  target.searchParams.set("result", "error");
  target.searchParams.set("detail", detail.slice(0, 200));
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

  // Both halves of the OAuth client must be configured. Without the
  // pair, the redirect to provider.authorizeUrl would 400 at the
  // provider's gate; better to fail with a clear in-app message
  // pointing at the Configure form.
  const { idKind, secretKind } = nativeMcpClientSecretKinds(provider.slug);
  const idPreview = await getWorkspaceSecretPreview(workspace.id, idKind);
  const secretPreview = await getWorkspaceSecretPreview(workspace.id, secretKind);
  if (!idPreview || !secretPreview) {
    return back(
      workspace.slug,
      provider.slug,
      `${provider.displayName} OAuth client isn't configured yet. ` +
        `A workspace admin needs to set it up first.`,
    );
  }
  const clientId = await getWorkspaceSecretPlaintext(workspace.id, idKind);

  const state = signNativeMcpState({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    userId,
    provider: provider.slug,
    connectionName,
  });

  const authorizeUrl = new URL(provider.authorizeUrl);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUriFor(provider.slug as McpProviderSlug));
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);
  if (provider.scopes.length > 0) {
    authorizeUrl.searchParams.set("scope", provider.scopes.join(" "));
  }

  return NextResponse.redirect(authorizeUrl.toString(), 302);
}
