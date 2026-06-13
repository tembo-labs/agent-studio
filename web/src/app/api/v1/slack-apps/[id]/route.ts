import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { deleteSlackAppFor, updateSlackAppFor } from "@/lib/api-v1/actions";
import { apiError, authErrorResponse } from "@/lib/api-v1/http";
import { serializeSlackApp } from "@/lib/api-v1/serializers";
import { getSlackApp } from "@/lib/slack-apps";

// GET    /api/v1/slack-apps/[id] — one Slack bot (secret-safe) (viewer)
// PATCH  /api/v1/slack-apps/[id] — update name/labels/owner/ids/secrets (admin)
// DELETE /api/v1/slack-apps/[id] — remove it (admin)
// Scoped to the key's workspace.

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams },
): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "workspace_admin");
  if (!auth.ok) return authErrorResponse(auth);

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "request body must be JSON");
  }

  const result = await updateSlackAppFor(auth, id, {
    ...(typeof body.name === "string" ? { name: body.name } : {}),
    ...(Array.isArray(body.agentLabels)
      ? { agentLabels: body.agentLabels.filter((l): l is string => typeof l === "string") }
      : {}),
    ...(typeof body.defaultOwnerUserId === "string"
      ? { defaultOwnerUserId: body.defaultOwnerUserId }
      : {}),
    ...("slackAppId" in body ? { slackAppId: (body.slackAppId as string) ?? null } : {}),
    ...("clientId" in body ? { clientId: (body.clientId as string) ?? null } : {}),
    ...(typeof body.signingSecret === "string" ? { signingSecret: body.signingSecret } : {}),
    ...(typeof body.clientSecret === "string" ? { clientSecret: body.clientSecret } : {}),
  });
  if (!result.ok) return apiError(result.status, result.error);

  return NextResponse.json({ slackApp: serializeSlackApp(result.slackApp) });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: RouteParams },
): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "workspace_admin");
  if (!auth.ok) return authErrorResponse(auth);

  const { id } = await params;
  const result = await deleteSlackAppFor(auth, id);
  if (!result.ok) return apiError(result.status, result.error);

  return new NextResponse(null, { status: 204 });
}
