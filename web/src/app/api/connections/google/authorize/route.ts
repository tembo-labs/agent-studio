import { NextResponse, type NextRequest } from "next/server";

import { getPublicOrigin, isGoogleConnectionConfigured } from "@/lib/config";
import { signOAuthState } from "@/lib/oauth-state";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

// Kicks off a Google OAuth2 flow scoped for Sheets access. Uses a
// **separate** OAuth client from the sign-in flow (GOOGLE_CONNECTIONS_*
// env vars vs GOOGLE_CLIENT_*) so the consent screen and scope set
// stay clean — sign-in is `openid email profile`, connections is
// `spreadsheets` + `userinfo.email`.
//
// `access_type=offline` + `prompt=consent` is the canonical pair to
// guarantee Google issues a refresh_token; without `prompt=consent`
// Google only ships a refresh_token on first-ever authorization for
// the user/app pair, which makes reconnect flows lose the long-lived
// token unpredictably.

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export async function GET(request: NextRequest) {
  if (!isGoogleConnectionConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google connections OAuth is not configured on this TAS instance. Set GOOGLE_CONNECTIONS_CLIENT_ID and GOOGLE_CONNECTIONS_CLIENT_SECRET.",
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
    connectionType: "google-sheets",
    connectionName: "google-sheets",
  });

  const redirectUri = `${getPublicOrigin()}/api/connections/google/callback`;
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.GOOGLE_CONNECTIONS_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url, 302);
}
