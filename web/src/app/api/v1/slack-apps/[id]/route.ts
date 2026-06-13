import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { apiError, authErrorResponse } from "@/lib/api-v1/http";
import { serializeSlackApp } from "@/lib/api-v1/serializers";
import { getSlackApp } from "@/lib/slack-apps";

// GET /api/v1/slack-apps/[id] — one Slack bot by id (secret-safe). Scoped to the
// key's workspace. Min role viewer.

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams },
): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "viewer");
  if (!auth.ok) return authErrorResponse(auth);

  const { id } = await params;
  const app = await getSlackApp(auth.workspace.id, id);
  if (!app) return apiError(404, "slack app not found");

  return NextResponse.json({ slackApp: serializeSlackApp(app) });
}
