import { NextResponse, type NextRequest } from "next/server";

import { getPublicOrigin } from "@/lib/config";
import { initiateConnection } from "@/lib/composio";
import { signComposioState } from "@/lib/oauth-state";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceBySlug,
  getWorkspaceSecretPreview,
  getWorkspaceSecretPlaintext,
  userIsMember,
} from "@/lib/workspace";

// Initiates a Composio-managed OAuth flow for a (workspace, toolkit)
// pair. The actual OAuth dance happens on Composio's domain; on
// completion they 302 the user back to our `callbackUrl`. We bake
// a signed state token into that callback URL so the handler can
// verify which (workspace, toolkit) the bounce belongs to.
//
// The Composio API key is workspace-scoped — we fetch it from
// workspace_secret here and pass through to the SDK wrapper.

function settingsErrorRedirect(
  _request: NextRequest,
  slug: string,
  toolkit: string,
  detail: string,
): NextResponse {
  // Anchor on getPublicOrigin() (BETTER_AUTH_URL) so the user always
  // lands on the canonical host — docker bind-address drift can
  // otherwise leave them on 0.0.0.0:3000 where the session cookie
  // (bound to localhost) isn't sent and the workspace 404s.
  const target = new URL(`/${slug}/settings`, getPublicOrigin());
  target.searchParams.set("composio", toolkit);
  target.searchParams.set("result", "error");
  target.searchParams.set("detail", detail.slice(0, 200));
  target.hash = "connections";
  return NextResponse.redirect(target, 302);
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const slug = request.nextUrl.searchParams.get("workspace");
  const toolkitRaw = request.nextUrl.searchParams.get("toolkit");
  if (!slug || !toolkitRaw) {
    return NextResponse.json(
      { error: "workspace and toolkit query params required" },
      { status: 400 },
    );
  }
  // Validate shape only — Composio's catalog decides what's a real
  // toolkit. We let the SDK reject unknowns at link time with its
  // own error, which is more informative than a stale local list.
  const toolkit = toolkitRaw.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(toolkit)) {
    return NextResponse.json(
      { error: `bad toolkit slug shape: ${toolkitRaw}` },
      { status: 400 },
    );
  }
  // Named slot for multi-account toolkits. Defaults to "default";
  // user picks a custom name via the Settings "Connect another"
  // flow. Constrain to a slug-ish charset so it round-trips through
  // URLs cleanly and matches the agent-spec parser expectations.
  const nameRaw = request.nextUrl.searchParams.get("name") ?? "default";
  const connectionName = nameRaw.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(connectionName)) {
    return NextResponse.json(
      { error: `bad connection name shape: ${nameRaw}` },
      { status: 400 },
    );
  }

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "not a member" }, { status: 403 });
  }

  // Workspace must have a Composio API key on file. Pre-check via the
  // preview (cheap, no decrypt) so we surface a clean redirect-back
  // error instead of letting the SDK throw later.
  const preview = await getWorkspaceSecretPreview(workspace.id, "composio_api_key");
  if (!preview) {
    return settingsErrorRedirect(
      request,
      workspace.slug,
      toolkit,
      "Set the Composio API key in Settings first.",
    );
  }
  const apiKey = await getWorkspaceSecretPlaintext(
    workspace.id,
    "composio_api_key",
  );

  const state = signComposioState({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    userId: session.user.id,
    toolkit,
    connectionName,
  });
  const callbackUrl = new URL(
    `${getPublicOrigin()}/api/connections/composio/callback`,
  );
  callbackUrl.searchParams.set("state", state);

  let link;
  try {
    link = await initiateConnection({
      apiKey,
      workspaceId: workspace.id,
      userId: session.user.id,
      toolkit,
      callbackUrl: callbackUrl.toString(),
    });
  } catch (err) {
    return settingsErrorRedirect(
      request,
      workspace.slug,
      toolkit,
      `init-failed: ${(err as Error).message}`,
    );
  }

  if (!link.redirectUrl) {
    return settingsErrorRedirect(
      request,
      workspace.slug,
      toolkit,
      "no-redirect-url",
    );
  }

  return NextResponse.redirect(link.redirectUrl, 302);
}
