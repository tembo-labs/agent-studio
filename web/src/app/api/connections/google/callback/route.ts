import { NextResponse, type NextRequest } from "next/server";

import { getPublicOrigin, isGoogleConnectionConfigured } from "@/lib/config";
import {
  saveConnection,
  type GoogleSheetsCredentials,
  type GoogleSheetsMetadata,
} from "@/lib/connections";
import { verifyOAuthState } from "@/lib/oauth-state";
import { getServerSession } from "@/lib/session";
import { userIsMember } from "@/lib/workspace";

// Google OAuth2 callback. Exchanges the code for an access_token +
// refresh_token, fetches the user's email for the connection's
// display metadata, and stores the credential row.

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
};

function backToSettings(
  request: NextRequest,
  slug: string,
  status: "ok" | "error",
  detail?: string,
): NextResponse {
  const target = new URL(`/${slug}/settings`, request.url);
  target.searchParams.set("connection", "google-sheets");
  target.searchParams.set("result", status);
  if (detail) target.searchParams.set("detail", detail.slice(0, 200));
  target.hash = "connections";
  return NextResponse.redirect(target, 302);
}

export async function GET(request: NextRequest) {
  if (!isGoogleConnectionConfigured()) {
    return NextResponse.json(
      { error: "Google connections OAuth is not configured on this TAS instance." },
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
  if (!payload || payload.connectionType !== "google-sheets") {
    return NextResponse.json(
      { error: "state failed signature verification" },
      { status: 400 },
    );
  }

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

  // Token exchange.
  const tokenBody = new URLSearchParams();
  tokenBody.set("code", code);
  tokenBody.set("client_id", process.env.GOOGLE_CONNECTIONS_CLIENT_ID!);
  tokenBody.set("client_secret", process.env.GOOGLE_CONNECTIONS_CLIENT_SECRET!);
  tokenBody.set(
    "redirect_uri",
    `${getPublicOrigin()}/api/connections/google/callback`,
  );
  tokenBody.set("grant_type", "authorization_code");

  let token: GoogleTokenResponse;
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });
    if (!res.ok) {
      const body = await res.text();
      return backToSettings(
        request,
        payload.workspaceSlug,
        "error",
        `token-exchange ${res.status}: ${body.slice(0, 160)}`,
      );
    }
    token = (await res.json()) as GoogleTokenResponse;
  } catch (err) {
    return backToSettings(
      request,
      payload.workspaceSlug,
      "error",
      `network: ${(err as Error).message}`,
    );
  }

  // Userinfo for the connection's display metadata. Tolerated to fail
  // — the connection itself is already valid; we just won't show an
  // email next to it in the list.
  let accountEmail: string | undefined;
  try {
    const res = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (res.ok) {
      const info = (await res.json()) as { email?: string };
      accountEmail = info.email;
    }
  } catch {
    // non-fatal
  }

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  const creds: GoogleSheetsCredentials = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    scope: token.scope,
    expires_at: expiresAt,
    token_type: token.token_type,
  };
  const metadata: GoogleSheetsMetadata = {
    account_email: accountEmail,
  };

  await saveConnection({
    workspaceId: payload.workspaceId,
    type: "google-sheets",
    name: payload.connectionName,
    credentials: creds,
    metadata,
    userId: session.user.id,
  });

  return backToSettings(request, payload.workspaceSlug, "ok");
}
