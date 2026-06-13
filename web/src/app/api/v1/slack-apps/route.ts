import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSlackAppFor } from "@/lib/api-v1/actions";
import { apiError, authErrorResponse } from "@/lib/api-v1/http";
import { serializeSlackApp } from "@/lib/api-v1/serializers";
import { listSlackApps } from "@/lib/slack-apps";

// GET  /api/v1/slack-apps — the workspace's Slack bots (secret-safe view) (viewer)
// POST /api/v1/slack-apps — create one (workspace_admin). Creation is metadata
//   only; the app comes up in a `configuring` state and must finish the browser
//   OAuth install (Settings → Slack apps → Install) before it's live.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "viewer");
  if (!auth.ok) return authErrorResponse(auth);

  const apps = await listSlackApps(auth.workspace.id);
  return NextResponse.json({ slackApps: apps.map(serializeSlackApp) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "workspace_admin");
  if (!auth.ok) return authErrorResponse(auth);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "request body must be JSON");
  }
  if (typeof body.name !== "string") {
    return apiError(400, "`name` (string) is required");
  }

  const result = await createSlackAppFor(auth, {
    name: body.name,
    agentLabels: Array.isArray(body.agentLabels)
      ? body.agentLabels.filter((l): l is string => typeof l === "string")
      : undefined,
    defaultOwnerUserId:
      typeof body.defaultOwnerUserId === "string" ? body.defaultOwnerUserId : undefined,
    slackAppId: typeof body.slackAppId === "string" ? body.slackAppId : undefined,
    signingSecret: typeof body.signingSecret === "string" ? body.signingSecret : undefined,
    clientId: typeof body.clientId === "string" ? body.clientId : undefined,
    clientSecret: typeof body.clientSecret === "string" ? body.clientSecret : undefined,
  });
  if (!result.ok) return apiError(result.status, result.error);

  return NextResponse.json(
    { slackApp: serializeSlackApp(result.slackApp) },
    { status: 201 },
  );
}
