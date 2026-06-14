import { type NextRequest } from "next/server";

import {
  bearerFromHeader,
  verifyForAgentsToken,
} from "@/lib/for-agents-token";
import {
  renderProviderMarkdown,
  type ForAgentsTool,
} from "@/lib/for-agents-markdown";
import { getMcpProvider } from "@/lib/mcp-providers";
import { listToolsForUser } from "@/lib/mcp-tools";

// Agent-facing native-MCP tool reference: GET /for-agents/<provider>.md?key=…
//
// The create-agent prompt links CAP here so it can read a native MCP's exact
// tool slugs (it can't introspect the provider's server). Auth is a signed,
// expiring, workspace+user-scoped token in `?key=` (see lib/for-agents-token);
// it unlocks only the cached tool catalog, nothing else. Served as text/markdown.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider: raw } = await params;
  const slug = raw.replace(/\.md$/, "");

  const token = bearerFromHeader(request.headers.get("authorization"));
  const payload = token
    ? verifyForAgentsToken(token, Math.floor(Date.now() / 1000))
    : null;
  if (!payload) {
    return text(
      "# Unauthorized\n\nSend `Authorization: Bearer <token>`.",
      401,
    );
  }

  const provider = getMcpProvider(slug);
  if (!provider) {
    return text(`# Unknown provider\n\nNo native MCP provider \`${slug}\`.`, 404);
  }

  const all = await listToolsForUser(payload.w, payload.u);
  const seen = new Set<string>();
  const tools: ForAgentsTool[] = [];
  for (const t of all) {
    if (t.source !== "native-mcp" || t.provider !== slug) continue;
    if (seen.has(t.slug)) continue; // same tool can be cached under many slots
    seen.add(t.slug);
    tools.push({ slug: t.slug, name: t.displayName, description: t.description });
  }
  tools.sort((a, b) => a.slug.localeCompare(b.slug));

  return text(renderProviderMarkdown(provider, tools), 200);
}
