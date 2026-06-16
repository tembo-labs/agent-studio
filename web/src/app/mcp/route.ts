import { NextResponse, type NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { authorizeApiRequest } from "@/lib/api-auth";
import { buildMcpServer } from "@/lib/mcp/server";

// MCP server endpoint (Streamable HTTP). A client such as Claude Code connects
// here to read and drive a TAS deployment:
//
//   claude mcp add --transport http tas https://<host>/mcp \
//     --header "Authorization: Bearer tas_..."
//
// Auth is the same per-user API key as /api/v1 (authorizeApiRequest) — we reject
// before constructing the server, then pass the resolved {workspace, userId,
// role} context into buildMcpServer so every tool is pre-scoped. Stateless: a
// fresh server + transport per POST (sessionIdGenerator undefined), so there's
// no cross-request state to store in a serverless deployment. enableJsonResponse
// keeps replies as plain JSON rather than SSE for simple request/response.
//
// We use the SDK's Web-standard transport (Request -> Response) so this is a
// native Next.js App Router handler with no Node req/res bridge.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  // Min role viewer to connect; write tools re-check operator on the resolved
  // context (ctx.role) inside buildMcpServer.
  const auth = await authorizeApiRequest(request, "viewer", "mcp");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  // Set by the runner when an agent calls /mcp from inside its own run, so
  // trigger_run can record that run as the parent of the run it spawns.
  const parentRunId = request.headers.get("x-tas-parent-run") ?? undefined;
  const server = buildMcpServer(auth, { parentRunId });
  await server.connect(transport);
  return transport.handleRequest(request);
}

// Stateless server: no standalone SSE stream and no session to terminate, so GET
// and DELETE aren't supported. Return 405 rather than 404 so clients can tell
// the endpoint exists but the method isn't offered.
export function GET(): Response {
  return NextResponse.json(
    { error: "method not allowed; POST JSON-RPC to this endpoint" },
    { status: 405 },
  );
}

export const DELETE = GET;
