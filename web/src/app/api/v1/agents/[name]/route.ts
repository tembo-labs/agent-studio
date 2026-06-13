import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { apiError, authErrorResponse } from "@/lib/api-v1/http";
import { serializeAgent } from "@/lib/api-v1/serializers";
import { getAgentByName } from "@/lib/workspace-agents";

// GET /api/v1/agents/[name] — one agent by its declared name, including the raw
// on-disk spec text so a client (Claude Code) can read what's deployed before
// proposing an edit. Min role viewer.

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ name: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams },
): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "viewer");
  if (!auth.ok) return authErrorResponse(auth);

  const { name } = await params;
  const found = await getAgentByName(auth.workspace.id, name);
  if (!found) return apiError(404, "agent not found");

  return NextResponse.json({
    agent: serializeAgent(found.agent),
    raw: found.raw,
    toolsModuleContent: found.toolsModuleContent ?? null,
    skillsContent: found.skillsContent ?? null,
  });
}
