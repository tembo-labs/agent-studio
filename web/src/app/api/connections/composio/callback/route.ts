import { NextResponse, type NextRequest } from "next/server";

import { writeAuditEvent } from "@/lib/audit-db";
import { getPublicOrigin } from "@/lib/config";
import { findLatestActiveConnection } from "@/lib/composio";
import { saveComposioConnection } from "@/lib/composio-connections";
import { fetchComposioToolkitTools } from "@/lib/composio-tools";
import { replaceToolsForConnection } from "@/lib/mcp-tools";
import { verifyComposioState } from "@/lib/oauth-state";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceSecretPlaintext,
  getWorkspaceSecretPreview,
  userIsMember,
} from "@/lib/workspace";

// Composio finishes its OAuth dance and 302s the user back here. We
// don't get the new connection's id directly — instead we ask Composio
// for the latest ACTIVE connection for (userId, toolkit) (with userId
// resolved from the signed state, not request.session) and cache that.
// Idempotent: if the user clicks "Reconnect" the upsert in
// saveComposioConnection just replaces the previous row for that
// (workspace, user, toolkit, name) slot.

function backToConnections(
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
  const target = new URL(`/${slug}/connections/composio`, getPublicOrigin());
  target.searchParams.set("composio", toolkit);
  target.searchParams.set("result", status);
  if (detail) target.searchParams.set("detail", detail.slice(0, 200));
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
    return backToConnections(
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
    return backToConnections(
      request,
      payload.workspaceSlug,
      payload.toolkit,
      "error",
      composioError,
    );
  }

  // Session user must match the user who initiated the link —
  // signed state proves provenance, but the new connection should
  // be owned by whoever is currently logged in (and that should be
  // the same person who clicked Connect in the same browser tab).
  if (session.user.id !== payload.userId) {
    return backToConnections(
      request,
      payload.workspaceSlug,
      payload.toolkit,
      "error",
      "Session user changed during OAuth flow.",
    );
  }

  let latest;
  try {
    latest = await findLatestActiveConnection({
      apiKey,
      workspaceId: payload.workspaceId,
      userId: payload.userId,
      toolkit: payload.toolkit,
    });
  } catch (err) {
    return backToConnections(
      request,
      payload.workspaceSlug,
      payload.toolkit,
      "error",
      `composio-lookup: ${(err as Error).message}`,
    );
  }

  if (!latest) {
    return backToConnections(
      request,
      payload.workspaceSlug,
      payload.toolkit,
      "error",
      "no-active-connection",
    );
  }

  const saved = await saveComposioConnection({
    workspaceId: payload.workspaceId,
    userId: payload.userId,
    toolkit: payload.toolkit,
    name: payload.connectionName,
    composioConnectionId: latest.connectedAccountId,
    authConfigId: latest.authConfigId,
    status: latest.status,
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
      toolkit: payload.toolkit,
      name: payload.connectionName,
    },
  });

  // Best-effort: prime the tool-list cache so Connections shows
  // "N tools available" immediately and the Tools page has the
  // catalog without waiting for a refresh. Composio's curated
  // subset is per-toolkit (not per-connection), so the result is
  // stable across users. Don't block the redirect on failure.
  try {
    const tools = await fetchComposioToolkitTools(apiKey, payload.toolkit);
    await replaceToolsForConnection({
      workspaceId: payload.workspaceId,
      userId: payload.userId,
      source: "composio",
      provider: payload.toolkit,
      connectionName: payload.connectionName,
      tools: tools.map((t) => ({
        slug: t.slug,
        displayName: t.name,
        description: t.description,
      })),
    });
  } catch (e) {
    console.error(
      `[composio/${payload.toolkit}] tool-cache prime failed:`,
      (e as Error).message,
    );
  }

  return backToConnections(
    request,
    payload.workspaceSlug,
    payload.toolkit,
    "ok",
  );
}
