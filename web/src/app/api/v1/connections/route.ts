import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { authErrorResponse } from "@/lib/api-v1/http";
import { serializeConnections } from "@/lib/api-v1/serializers";
import { listConnectionsForUser } from "@/lib/composio-connections";
import { listNativeConnectionsForUser } from "@/lib/connections";

// GET /api/v1/connections — the API key user's per-user connection status across
// composio + native-mcp (provider, slot name, status). Lets a client check
// whether the credentials an agent declares are authorized before triggering a
// run. No tokens are ever returned. Min role viewer.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "viewer");
  if (!auth.ok) return authErrorResponse(auth);

  const [composio, nativeMcp] = await Promise.all([
    listConnectionsForUser(auth.workspace.id, auth.userId),
    listNativeConnectionsForUser(auth.workspace.id, auth.userId),
  ]);
  return NextResponse.json({ connections: serializeConnections(composio, nativeMcp) });
}
