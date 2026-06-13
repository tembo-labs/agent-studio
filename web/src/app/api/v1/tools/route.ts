import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { authErrorResponse } from "@/lib/api-v1/http";
import { serializeTool } from "@/lib/api-v1/serializers";
import { listToolsForUser } from "@/lib/mcp-tools";

// GET /api/v1/tools — the cached tool catalog for the API key's user, across
// composio + native-mcp. The `slug` of each tool is what goes into an agent's
// `connections: tools: [...]`, so this is the lookup a client uses when
// authoring connections. Min role viewer.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "viewer");
  if (!auth.ok) return authErrorResponse(auth);

  const tools = await listToolsForUser(auth.workspace.id, auth.userId);
  return NextResponse.json({ tools: tools.map(serializeTool) });
}
