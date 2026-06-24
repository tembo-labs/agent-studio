import { type NextRequest } from "next/server";

import { getPublicOrigin, isForAgentsPublic } from "@/lib/config";
import { renderIndexMarkdown } from "@/lib/for-agents-markdown";
import {
  bearerFromHeader,
  verifyForAgentsToken,
} from "@/lib/for-agents-token";
import { listMcpProviders } from "@/lib/mcp-providers";
import { listCachedNativeProviders, listToolsForUser } from "@/lib/mcp-tools";

// Agent-facing index: GET /for-agents → a linked list of the per-provider
// tool-reference pages. Token-gated by default; an instance can opt into a
// public reference (isForAgentsPublic) — same rule as the provider pages.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const token = bearerFromHeader(request.headers.get("authorization"));
  const payload = token
    ? verifyForAgentsToken(token, Math.floor(Date.now() / 1000))
    : null;
  if (!payload && !isForAgentsPublic()) {
    return new Response("# Unauthorized\n\nSend `Authorization: Bearer <token>`.", {
      status: 401,
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }

  // With a token: providers the caller's workspace has connected. Tokenless
  // (public instance): every provider with cached tools.
  const connected = new Set(
    payload
      ? (await listToolsForUser(payload.w, payload.u))
          .filter((t) => t.source === "native-mcp")
          .map((t) => t.provider)
      : await listCachedNativeProviders(),
  );
  const md = renderIndexMarkdown(
    `${getPublicOrigin()}/for-agents`,
    listMcpProviders(),
    connected,
  );
  return new Response(md, {
    status: 200,
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
