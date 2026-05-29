// Native MCP provider catalog.
//
// Each entry describes a provider whose connection mode is
// "native-mcp" — TAS-owned OAuth, tokens stored in
// workspace_connection, agent runtime talks directly to the
// provider's official MCP server.
//
// Catalog is tiny on purpose: just display label + the MCP server
// URL. Everything else (OAuth endpoints, scopes, registration URL,
// supported auth methods) is discovered at run time from the
// provider's /.well-known/oauth-protected-resource and the linked
// /.well-known/oauth-authorization-server. This means TAS picks up
// new MCP providers with just one catalog entry — no per-provider
// authorize/callback code, no manual OAuth-client registration on
// the customer's side.

import { getPublicOrigin } from "@/lib/config";

export type McpProviderSlug = "attio";

export type McpProvider = {
  slug: McpProviderSlug;
  displayName: string;
  /** The MCP server URL pydantic-ai connects to with the user's
   *  bearer token at run time. The /.well-known endpoints are
   *  derived from this URL's origin. */
  mcpServerUrl: string;
};

export const MCP_PROVIDERS: Record<McpProviderSlug, McpProvider> = {
  attio: {
    slug: "attio",
    displayName: "Attio",
    mcpServerUrl: "https://mcp.attio.com/mcp",
  },
};

export function getMcpProvider(slug: string): McpProvider | null {
  return MCP_PROVIDERS[slug as McpProviderSlug] ?? null;
}

export function listMcpProviders(): McpProvider[] {
  return Object.values(MCP_PROVIDERS);
}

/**
 * URL of the provider's protected-resource metadata document. Per
 * the MCP authorization spec (and OAuth 2.0 Protected Resource
 * Metadata, RFC 9728), this lives at /.well-known/oauth-protected-
 * resource on the resource server's origin. The document points us
 * at the actual authorization server(s) and supported scopes.
 */
export function protectedResourceUrl(mcpServerUrl: string): string {
  const u = new URL(mcpServerUrl);
  return `${u.origin}/.well-known/oauth-protected-resource`;
}

/**
 * Resolved redirect URI for a given provider's OAuth callback. The
 * redirect URI we register dynamically (via DCR) at authorize time
 * must match exactly what the provider receives in the callback,
 * so both call sites share this single source of truth.
 */
export function redirectUriFor(slug: McpProviderSlug): string {
  return `${getPublicOrigin()}/api/connections/native/${slug}/callback`;
}
