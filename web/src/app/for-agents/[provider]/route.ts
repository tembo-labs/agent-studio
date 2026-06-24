import { type NextRequest } from "next/server";

import {
  bearerFromHeader,
  verifyForAgentsToken,
} from "@/lib/for-agents-token";
import {
  renderProviderMarkdown,
  type ForAgentsTool,
} from "@/lib/for-agents-markdown";
import { isForAgentsPublic } from "@/lib/config";
import { getMcpProvider } from "@/lib/mcp-providers";
import { listProviderToolCatalog, listToolsForUser } from "@/lib/mcp-tools";

// Agent-facing native-MCP tool reference: GET /for-agents/<provider>.md
//
// The create-agent prompt links CAP here so it can read a native MCP's exact
// tool slugs + parameters (it can't introspect the provider's server). For
// third-party providers, auth is a signed, expiring, workspace+user-scoped
// bearer token (see lib/for-agents-token) that unlocks only that workspace's
// cached tool catalog. The self-key provider (tembo-agent-studio) is TAS's own
// MCP — its tools are identical for everyone and already public API, so its
// reference is served WITHOUT a token. Served as text/markdown.

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

  const provider = getMcpProvider(slug);
  if (!provider) {
    return text(`# Unknown provider\n\nNo native MCP provider \`${slug}\`.`, 404);
  }

  // Tokenless access is allowed when either:
  //   - the provider is TAS's own self-key MCP (tembo-agent-studio) — its tools
  //     are identical for everyone and already public API; or
  //   - the instance opted into a public reference (isForAgentsPublic, e.g. our
  //     dogfood box) — then every provider's reference is viewable.
  // Otherwise a third-party reference stays gated (its tool list reveals which
  // integrations a workspace connected).
  const tokenlessOk = provider.authMode === "self-key" || isForAgentsPublic();

  const token = bearerFromHeader(request.headers.get("authorization"));
  const payload = token
    ? verifyForAgentsToken(token, Math.floor(Date.now() / 1000))
    : null;
  if (!payload && !tokenlessOk) {
    return text(
      "# Unauthorized\n\nSend `Authorization: Bearer <token>`.",
      401,
    );
  }

  // With a token: the caller's own workspace catalog. Tokenless: the
  // workspace-agnostic canonical catalog for the provider.
  const all = payload
    ? await listToolsForUser(payload.w, payload.u)
    : await listProviderToolCatalog(slug);
  const seen = new Set<string>();
  const tools: ForAgentsTool[] = [];
  for (const t of all) {
    if (t.source !== "native-mcp" || t.provider !== slug) continue;
    if (seen.has(t.slug)) continue; // same tool can be cached under many slots
    seen.add(t.slug);
    tools.push({
      slug: t.slug,
      name: t.displayName,
      description: t.description,
      inputSchema: t.inputSchema,
    });
  }
  tools.sort((a, b) => a.slug.localeCompare(b.slug));

  return text(renderProviderMarkdown(provider, tools), 200);
}
