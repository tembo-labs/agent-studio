import { NextResponse, type NextRequest } from "next/server";

import { writeAuditEvent } from "@/lib/audit-db";
import { getPublicOrigin } from "@/lib/config";
import { verifySlackInstallState } from "@/lib/oauth-state";
import {
  getSlackAppById,
  getSlackAppSecrets,
  setSlackAppInstall,
} from "@/lib/slack-apps";

export const dynamic = "force-dynamic";

type SlackOAuthResponse = {
  ok?: boolean;
  error?: string;
  access_token?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id?: string };
};

// Slack redirects here after the user authorizes "Add to Slack". We
// verify our signed state, exchange the code for a bot token, and store
// it on the app row, then bounce back to Settings → Slack apps.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
): Promise<NextResponse> {
  const { appId } = await params;
  const sp = request.nextUrl.searchParams;
  const origin = getPublicOrigin();

  const stateRaw = sp.get("state");
  const state = stateRaw ? verifySlackInstallState(stateRaw) : null;
  // Forged/missing state, or a mismatched app — bail to home rather than
  // leak which app ids exist.
  if (!state || state.slackAppId !== appId) {
    return NextResponse.redirect(`${origin}/`, 302);
  }
  const slug = state.workspaceSlug;
  // Bounce back to the app's detail view in the Build → Slack apps area.
  const back = (result: string, detail?: string) => {
    const u = new URL(`${origin}/${slug}/slack-apps/${appId}`);
    u.searchParams.set("slack", result);
    if (detail) u.searchParams.set("detail", detail);
    return NextResponse.redirect(u.toString(), 302);
  };

  const slackError = sp.get("error");
  if (slackError) return back("error", slackError);
  const code = sp.get("code");
  if (!code) return back("error", "no_code");

  const app = await getSlackAppById(appId);
  if (!app || app.workspaceId !== state.workspaceId) {
    return back("error", "app_missing");
  }
  const secrets = await getSlackAppSecrets(appId);
  if (!app.clientId || !secrets?.clientSecret) {
    return back("error", "missing_client_credentials");
  }

  let json: SlackOAuthResponse;
  try {
    const res = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
      body: new URLSearchParams({
        client_id: app.clientId,
        client_secret: secrets.clientSecret,
        code,
        redirect_uri: `${origin}/api/slack/${appId}/callback`,
      }),
    });
    json = (await res.json()) as SlackOAuthResponse;
  } catch {
    return back("error", "token_exchange_failed");
  }
  if (!json.ok) return back("error", json.error ?? "oauth_failed");

  const botToken = json.access_token;
  const teamId = json.team?.id;
  const botUserId = json.bot_user_id;
  if (!botToken || !teamId || !botUserId) {
    return back("error", "incomplete_install");
  }

  await setSlackAppInstall(appId, {
    botToken,
    teamId,
    botUserId,
    slackAppId: json.app_id ?? null,
  });
  await writeAuditEvent({
    workspaceId: app.workspaceId,
    actorUserId: app.createdBy,
    source: "system",
    kind: "slack_app.installed",
    targetType: "slack_app",
    targetId: appId,
    agentName: null,
    payload: { teamId },
  });

  return back("installed");
}
