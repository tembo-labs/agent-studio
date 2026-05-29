import "server-only";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Talk to a native MCP server over the streamable-HTTP transport
// and ask for its tool list. Used at connect time + on demand from
// the Connections page; the caller persists the result via
// lib/mcp-tools (the normalized workspace_mcp_tool table).
//
// The SDK handles the protocol dance for us (initialize →
// notifications/initialized → tools/list, plus Mcp-Session-Id
// header juggling). All we do is plumb the bearer token through
// `requestInit.headers` so the auth-protected /mcp endpoint
// accepts the request.

/**
 * Fetch the tool list from a native MCP server. Throws on any
 * transport / protocol / auth error so callers can decide whether
 * to surface the failure or silently fall back to no cached tools.
 *
 * @param serverUrl  the provider's MCP endpoint, e.g. https://mcp.attio.com/mcp
 * @param accessToken OAuth bearer token from the saved connection
 */
export type FetchedMcpTool = {
  slug: string;
  name: string;
  description: string | undefined;
};

export async function fetchNativeMcpTools(
  serverUrl: string,
  accessToken: string,
): Promise<FetchedMcpTool[]> {
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  const client = new Client(
    { name: "Tembo Agent Studio", version: "0.4" },
    { capabilities: {} },
  );

  await client.connect(transport);
  try {
    const result = await client.listTools();
    return result.tools.map((t) => ({
      slug: t.name,
      name: typeof t.title === "string" ? t.title : t.name,
      description:
        typeof t.description === "string" ? t.description : undefined,
    }));
  } finally {
    await client.close().catch(() => {
      // best-effort close; nothing useful to do if it fails after we
      // already got the tool list back
    });
  }
}
