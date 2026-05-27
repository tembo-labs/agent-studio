// Native MCP provider catalog. Each entry describes a provider
// whose connection mode is "native-mcp" — TAS-owned OAuth flow,
// tokens stored in workspace_connection, agent runtime talks
// directly to the provider's official MCP server.
//
// This is the *registry* — UI and OAuth routes read from here. Adding
// a new provider means adding one entry plus a per-provider OAuth
// callback handler (the authorize side is generic; tokens-endpoint
// shapes vary just enough that callbacks usually need provider-
// specific code).
//
// Lives in lib (not server-only) because the Connections UI uses
// the display fields client-side. The OAuth URLs are public-facing
// information; nothing in this file is sensitive.

import { getPublicOrigin } from "@/lib/config";

export type McpProviderSlug = "attio";

export type McpProvider = {
  slug: McpProviderSlug;
  displayName: string;
  /** Three-line markdown explaining the OAuth-client setup steps. */
  setupInstructions: string;
  /** Where to register the OAuth app. */
  developerConsoleUrl: string;
  /** Auth pattern. v0.4 ships oauth2 only; pat is reserved for
   *  providers that accept Personal Access Tokens (GitHub, Linear). */
  authType: "oauth2" | "pat";
  /** Provider's OAuth 2.0 authorize endpoint. */
  authorizeUrl: string;
  /** Provider's OAuth 2.0 token-exchange endpoint. */
  tokenUrl: string;
  /** Space-separated scope list to request. */
  scopes: string[];
  /** The MCP server URL pydantic-ai's MCPServerStreamableHTTP
   *  connects to once we hold an access token. */
  mcpServerUrl: string;
};

export const MCP_PROVIDERS: Record<McpProviderSlug, McpProvider> = {
  attio: {
    slug: "attio",
    displayName: "Attio",
    developerConsoleUrl: "https://app.attio.com/settings/developers",
    authType: "oauth2",
    // NOTE: Attio's OAuth + MCP endpoints below should be verified
    // against their current docs before the first connect attempt.
    // The shape is consistent with standard OAuth 2.0 + MCP-over-SSE
    // providers; specific URLs may need a one-line adjustment.
    authorizeUrl: "https://app.attio.com/authorize",
    tokenUrl: "https://app.attio.com/oauth/token",
    scopes: [
      "record_permission:read",
      "record_permission:read-write",
      "object_configuration:read",
      "list_entry:read",
      "list_configuration:read",
    ],
    mcpServerUrl: "https://mcp.attio.com/mcp",
    setupInstructions: `1. Open **Attio → Settings → Developers** and click **Create an OAuth app**.
2. Set the redirect URI exactly to:
   \`{{REDIRECT_URI}}\`
3. Copy the **Client ID** and **Client Secret** into the fields below.`,
  },
};

export function getMcpProvider(slug: string): McpProvider | null {
  return MCP_PROVIDERS[slug as McpProviderSlug] ?? null;
}

export function listMcpProviders(): McpProvider[] {
  return Object.values(MCP_PROVIDERS);
}

/**
 * Resolved redirect URI for a given provider's OAuth callback.
 * Anchored on getPublicOrigin() so we get the canonical https URL
 * the operator sees, not a docker bind-address.
 */
export function redirectUriFor(slug: McpProviderSlug): string {
  return `${getPublicOrigin()}/api/connections/${slug}/callback`;
}

/**
 * Setup-instructions string with the redirect URI substituted in.
 * Used by the Connections page's Configure form.
 */
export function setupInstructionsFor(slug: McpProviderSlug): string {
  return MCP_PROVIDERS[slug].setupInstructions.replace(
    /\{\{REDIRECT_URI\}\}/g,
    redirectUriFor(slug),
  );
}
