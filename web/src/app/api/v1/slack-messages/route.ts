import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { sendSlackMessageFor } from "@/lib/api-v1/actions";
import { apiError, authErrorResponse } from "@/lib/api-v1/http";

// POST /api/v1/slack-messages — send a Slack message from a workspace Slack app
// (operator). DM a person by `toEmail` or post to a `channel`. Mirrors the MCP
// `send_slack_message` tool; both share sendSlackMessageFor.

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "operator");
  if (!auth.ok) return authErrorResponse(auth);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "request body must be JSON");
  }
  if (typeof body.text !== "string") {
    return apiError(400, "`text` (string) is required");
  }

  const result = await sendSlackMessageFor(auth, {
    text: body.text,
    toEmail: typeof body.toEmail === "string" ? body.toEmail : undefined,
    channel: typeof body.channel === "string" ? body.channel : undefined,
    slackApp: typeof body.slackApp === "string" ? body.slackApp : undefined,
    threadTs: typeof body.threadTs === "string" ? body.threadTs : undefined,
  });
  if (!result.ok) return apiError(result.status, result.error);

  return NextResponse.json({ channel: result.channel, ts: result.ts });
}
