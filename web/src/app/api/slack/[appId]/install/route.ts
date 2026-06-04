import { NextResponse, type NextRequest } from "next/server";

import { getPublicOrigin } from "@/lib/config";
import { signSlackInstallState } from "@/lib/oauth-state";
import { getServerSession } from "@/lib/session";
import { getSlackApp } from "@/lib/slack-apps";
import { SLACK_BOT_SCOPES } from "@/lib/slack-scopes";
import { getWorkspaceBySlug, getWorkspaceRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// "Add to Slack" — kicks off the OAuth v2 install. Admin-gated: the link
// carries ?ws=<slug> and we verify the session user is an admin of that
// workspace and that the app belongs to it. Redirects to Slack's
// authorize endpoint with a signed state; Slack returns to /callback.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
): Promise<NextResponse> {
  const { appId } = await params;
  const slug = request.nextUrl.searchParams.get("ws") ?? "";

  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
  }
  if ((await getWorkspaceRole(workspace.id, session.user.id)) !== "workspace_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const app = await getSlackApp(workspace.id, appId);
  if (!app) {
    return NextResponse.json({ error: "unknown app" }, { status: 404 });
  }
  if (!app.clientId) {
    return NextResponse.json(
      { error: "Set the OAuth client ID + secret before installing." },
      { status: 400 },
    );
  }

  const origin = getPublicOrigin();
  const state = signSlackInstallState({
    slackAppId: app.id,
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
  });
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", app.clientId);
  url.searchParams.set("scope", SLACK_BOT_SCOPES.join(","));
  url.searchParams.set("redirect_uri", `${origin}/api/slack/${app.id}/callback`);
  url.searchParams.set("state", state);
  return NextResponse.redirect(url.toString(), 302);
}
