import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { apiError, authErrorResponse } from "@/lib/api-v1/http";
import { serializeAgent } from "@/lib/api-v1/serializers";
import { listAgents } from "@/lib/workspace-agents";

// GET /api/v1/agents — list every agent in the workspace's connected repo
// (valid and invalid, so a client can see parse failures). Bearer-authed via an
// API key; min role viewer.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "viewer");
  if (!auth.ok) return authErrorResponse(auth);

  const result = await listAgents(auth.workspace.id);
  if (!result.ok) {
    if (result.error === "no-repo") {
      return apiError(409, "no repository connected to this workspace");
    }
    return apiError(502, "could not read agents from the repository", result.detail);
  }

  return NextResponse.json({ agents: result.agents.map(serializeAgent) });
}
