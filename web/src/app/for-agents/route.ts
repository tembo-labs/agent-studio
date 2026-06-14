import { type NextRequest } from "next/server";

import { getPublicOrigin } from "@/lib/config";
import { renderIndexMarkdown } from "@/lib/for-agents-markdown";
import { verifyForAgentsToken } from "@/lib/for-agents-token";
import { listMcpProviders } from "@/lib/mcp-providers";
import { listToolsForUser } from "@/lib/mcp-tools";

// Agent-facing index: GET /for-agents?key=… → a linked list of the per-provider
// tool-reference pages. Same signed-token auth as the provider pages.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const key = request.nextUrl.searchParams.get("key");
  const payload = key
    ? verifyForAgentsToken(key, Math.floor(Date.now() / 1000))
    : null;
  if (!key || !payload) {
    return new Response("# Unauthorized\n\nMissing or invalid `?key=` token.", {
      status: 401,
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }

  const all = await listToolsForUser(payload.w, payload.u);
  const connected = new Set(
    all.filter((t) => t.source === "native-mcp").map((t) => t.provider),
  );
  const md = renderIndexMarkdown(
    `${getPublicOrigin()}/for-agents`,
    key,
    listMcpProviders(),
    connected,
  );
  return new Response(md, {
    status: 200,
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
