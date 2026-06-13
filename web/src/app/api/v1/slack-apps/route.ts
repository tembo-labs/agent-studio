import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { authErrorResponse } from "@/lib/api-v1/http";
import { serializeSlackApp } from "@/lib/api-v1/serializers";
import { listSlackApps } from "@/lib/slack-apps";

// GET /api/v1/slack-apps — the workspace's Slack bots (secret-safe view).
// Min role viewer.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "viewer");
  if (!auth.ok) return authErrorResponse(auth);

  const apps = await listSlackApps(auth.workspace.id);
  return NextResponse.json({ slackApps: apps.map(serializeSlackApp) });
}
