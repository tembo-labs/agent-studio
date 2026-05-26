import { NextResponse, type NextRequest } from "next/server";

import { getPublicOrigin, isSlackConnectionConfigured } from "@/lib/config";
import { signOAuthState } from "@/lib/oauth-state";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

// Kicks off a Slack OAuth v2 flow for the given workspace. The session
// + membership check happens here (the callback can't trust the
// querystring on its own); the workspace context survives the
// round-trip embedded in a signed state token.
//
// MVP scope: a single Slack connection per workspace. We name it
// "slack" by convention — when we add multi-instance later, the UI
// will let users pick a name and this route will accept it as a
// query param.

const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
// Bot scopes for the v0.3 connections substrate. chat:write lets the
// bot post messages it's invited to; chat:write.public lets it post
// into public channels without needing an explicit invite. team:read
// gives us the team display name for the connection's metadata row.
const SLACK_BOT_SCOPES = "chat:write,chat:write.public,team:read";

export async function GET(request: NextRequest) {
  if (!isSlackConnectionConfigured()) {
    return NextResponse.json(
      {
        error:
          "Slack OAuth is not configured on this TAS instance. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.",
      },
      { status: 503 },
    );
  }

  const session = await getServerSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const slug = request.nextUrl.searchParams.get("workspace");
  if (!slug) {
    return NextResponse.json(
      { error: "workspace query param required" },
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

  const state = signOAuthState({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    connectionType: "slack",
    connectionName: "slack",
  });

  const redirectUri = `${getPublicOrigin()}/api/connections/slack/callback`;
  const url = new URL(SLACK_AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.SLACK_CLIENT_ID!);
  url.searchParams.set("scope", SLACK_BOT_SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url, 302);
}
