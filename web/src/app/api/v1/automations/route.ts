import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createAutomationFor } from "@/lib/api-v1/actions";
import { apiError, authErrorResponse } from "@/lib/api-v1/http";
import { serializeAutomation } from "@/lib/api-v1/serializers";
import { listAutomations } from "@/lib/automations-api";

// GET  /api/v1/automations — list the workspace's scheduled automations (viewer)
// POST /api/v1/automations — create one (operator). Body:
//   { name, agent, cron, inputMessage?, enabled?, useDraft? }

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "viewer");
  if (!auth.ok) return authErrorResponse(auth);

  const automations = await listAutomations(auth.workspace.id);
  return NextResponse.json({ automations: automations.map(serializeAutomation) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "operator");
  if (!auth.ok) return authErrorResponse(auth);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "request body must be JSON");
  }
  if (typeof body.name !== "string" || typeof body.agent !== "string" || typeof body.cron !== "string") {
    return apiError(400, "`name`, `agent`, and `cron` (strings) are required");
  }

  const result = await createAutomationFor(auth, {
    name: body.name,
    agent: body.agent,
    cron: body.cron,
    inputMessage: typeof body.inputMessage === "string" ? body.inputMessage : undefined,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    useDraft: body.useDraft === true,
  });
  if (!result.ok) return apiError(result.status, result.error);

  return NextResponse.json(
    { automation: serializeAutomation(result.automation) },
    { status: 201 },
  );
}
