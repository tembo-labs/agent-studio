import { NextResponse, type NextRequest } from "next/server";

import { getPublicOrigin, isSlackConnectionConfigured } from "@/lib/config";
import {
  saveConnection,
  type SlackCredentials,
  type SlackMetadata,
} from "@/lib/connections";
import { verifyOAuthState } from "@/lib/oauth-state";
import { getServerSession } from "@/lib/session";
import { userIsMember } from "@/lib/workspace";

// Slack OAuth v2 callback. Exchanges the auth code for a bot token,
// persists it as a workspace_connection row, and 302s the user back
// to the workspace's Settings → Connections section with a banner
// flag in the querystring.

const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

type SlackTokenOk = {
  ok: true;
  access_token: string;
  scope: string;
  bot_user_id: string;
  team: { id: string; name: string };
};

type SlackTokenErr = {
  ok: false;
  error: string;
};

function backToSettings(
  request: NextRequest,
  slug: string,
  status: "ok" | "error",
  detail?: string,
): NextResponse {
  const target = new URL(`/${slug}/settings`, request.url);
  target.searchParams.set("connection", "slack");
  target.searchParams.set("result", status);
  if (detail) target.searchParams.set("detail", detail.slice(0, 200));
  target.hash = "connections";
  return NextResponse.redirect(target, 302);
}

export async function GET(request: NextRequest) {
  if (!isSlackConnectionConfigured()) {
    return NextResponse.json(
      { error: "Slack OAuth is not configured on this TAS instance." },
      { status: 503 },
    );
  }

  const session = await getServerSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (!state) {
    return NextResponse.json({ error: "missing state" }, { status: 400 });
  }

  const payload = verifyOAuthState(state);
  if (!payload || payload.connectionType !== "slack") {
    return NextResponse.json(
      { error: "state failed signature verification" },
      { status: 400 },
    );
  }

  // Re-check membership against the verified state — never trust the
  // raw querystring for authorization.
  const isMember = await userIsMember(payload.workspaceId, session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "not a member" }, { status: 403 });
  }

  if (oauthError) {
    return backToSettings(request, payload.workspaceSlug, "error", oauthError);
  }
  if (!code) {
    return backToSettings(request, payload.workspaceSlug, "error", "missing-code");
  }

  // Token exchange. Slack returns 200 with `ok: false` on app-level
  // errors (e.g. mismatched redirect URI) so we can't rely on the
  // HTTP status alone — read the `ok` field explicitly.
  const tokenBody = new URLSearchParams();
  tokenBody.set("code", code);
  tokenBody.set("client_id", process.env.SLACK_CLIENT_ID!);
  tokenBody.set("client_secret", process.env.SLACK_CLIENT_SECRET!);
  tokenBody.set(
    "redirect_uri",
    `${getPublicOrigin()}/api/connections/slack/callback`,
  );

  let json: SlackTokenOk | SlackTokenErr;
  try {
    const res = await fetch(SLACK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });
    json = (await res.json()) as SlackTokenOk | SlackTokenErr;
  } catch (err) {
    return backToSettings(
      request,
      payload.workspaceSlug,
      "error",
      `network: ${(err as Error).message}`,
    );
  }

  if (!json.ok) {
    return backToSettings(request, payload.workspaceSlug, "error", json.error);
  }

  const creds: SlackCredentials = {
    access_token: json.access_token,
    scope: json.scope,
    bot_user_id: json.bot_user_id,
    team_id: json.team.id,
  };
  const metadata: SlackMetadata = {
    team_name: json.team.name,
  };

  await saveConnection({
    workspaceId: payload.workspaceId,
    type: "slack",
    name: payload.connectionName,
    credentials: creds,
    metadata,
    userId: session.user.id,
  });

  return backToSettings(request, payload.workspaceSlug, "ok");
}
