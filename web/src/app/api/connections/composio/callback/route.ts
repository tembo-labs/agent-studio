import { NextResponse, type NextRequest } from "next/server";

import { getPublicOrigin } from "@/lib/config";
import { findLatestActiveConnection } from "@/lib/composio";
import { saveComposioConnection } from "@/lib/composio-connections";
import { verifyComposioState } from "@/lib/oauth-state";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceSecretPlaintext,
  getWorkspaceSecretPreview,
  userIsMember,
} from "@/lib/workspace";

// Composio finishes its OAuth dance and 302s the user back here. We
// don't get the new connection's id directly — instead we ask Composio
// for the latest ACTIVE connection for (userId=workspaceId, toolkit)
// and cache that. Idempotent: if the user clicks "Reconnect" the
// upsert in saveComposioConnection just replaces the previous row.

function backToSettings(
  _request: NextRequest,
  slug: string,
  toolkit: string,
  status: "ok" | "error",
  detail?: string,
): NextResponse {
  // Anchor on getPublicOrigin() (BETTER_AUTH_URL) so the post-OAuth
  // landing is on the canonical host even if Composio bounces the
  // browser to a request.url that resolved to 0.0.0.0 inside the
  // container.
  const target = new URL(`/${slug}/settings`, getPublicOrigin());
  target.searchParams.set("composio", toolkit);
  target.searchParams.set("result", status);
  if (detail) target.searchParams.set("detail", detail.slice(0, 200));
  target.hash = "connections";
  return NextResponse.redirect(target, 302);
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const state = request.nextUrl.searchParams.get("state");
  if (!state) {
    return NextResponse.json({ error: "missing state" }, { status: 400 });
  }
  const payload = verifyComposioState(state);
  if (!payload) {
    return NextResponse.json(
      { error: "state failed signature verification" },
      { status: 400 },
    );
  }
  // No allowlist check — TAS accepts any toolkit slug Composio
  // accepted at link initiation. The state's signed payload is the
  // trust boundary.

  const isMember = await userIsMember(payload.workspaceId, session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "not a member" }, { status: 403 });
  }

  // Composio key must still be present — if it was removed between
  // /authorize and /callback the workspace can't query Composio for
  // the resulting connection.
  const preview = await getWorkspaceSecretPreview(
    payload.workspaceId,
    "composio_api_key",
  );
  if (!preview) {
    return backToSettings(
      request,
      payload.workspaceSlug,
      payload.toolkit,
      "error",
      "Composio API key was removed during OAuth.",
    );
  }
  const apiKey = await getWorkspaceSecretPlaintext(
    payload.workspaceId,
    "composio_api_key",
  );

  const composioError = request.nextUrl.searchParams.get("error");
  if (composioError) {
    return backToSettings(
      request,
      payload.workspaceSlug,
      payload.toolkit,
      "error",
      composioError,
    );
  }

  let latest;
  try {
    latest = await findLatestActiveConnection({
      apiKey,
      workspaceId: payload.workspaceId,
      toolkit: payload.toolkit,
    });
  } catch (err) {
    return backToSettings(
      request,
      payload.workspaceSlug,
      payload.toolkit,
      "error",
      `composio-lookup: ${(err as Error).message}`,
    );
  }

  if (!latest) {
    return backToSettings(
      request,
      payload.workspaceSlug,
      payload.toolkit,
      "error",
      "no-active-connection",
    );
  }

  await saveComposioConnection({
    workspaceId: payload.workspaceId,
    toolkit: payload.toolkit,
    composioConnectionId: latest.connectedAccountId,
    authConfigId: latest.authConfigId,
    status: latest.status,
    metadata: {},
    userId: session.user.id,
  });

  return backToSettings(request, payload.workspaceSlug, payload.toolkit, "ok");
}
