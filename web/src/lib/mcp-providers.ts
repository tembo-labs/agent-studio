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

export type McpProviderSlug =
  | "attio"
  | "pylon"
  | "hubspot"
  | "fathom"
  | "dialed"
  | "tembo";

export type McpProvider = {
  slug: McpProviderSlug;
  displayName: string;
  /** The MCP server URL pydantic-ai connects to with the user's
   *  bearer token at run time. The /.well-known endpoints are
   *  derived from this URL's origin. Empty for "self-key" providers
   *  (TAS itself) — resolved at connect time via tasMcpServerUrl(),
   *  since the origin is env-derived rather than a constant. */
  mcpServerUrl: string;
  /** Exact OAuth authorization-server origins this provider is allowed
   *  to advertise through protected-resource discovery. */
  oauthAuthorizationServerOrigins: string[];
  /**
   * How TAS obtains an OAuth client for this provider:
   *  - "dcr" (default): Dynamic Client Registration — TAS self-registers
   *    a public client at Connect time; zero per-customer setup.
   *  - "manual": the provider doesn't support DCR (or requires a
   *    confidential client). An admin creates an OAuth app at the
   *    provider and stores its client_id/secret in TAS
   *    (workspace_native_oauth_client); the flow uses that confidential
   *    client. HubSpot is the first of these.
   *  - "self-key": no upstream OAuth at all — the "provider" is TAS's
   *    own /mcp server. Connect mints a per-user `tas_` API key and
   *    stores it as the connection's bearer; the key's owner (and their
   *    live workspace role) is what /mcp enforces. Tembo is the first.
   */
  authMode?: "dcr" | "manual" | "self-key";
};

export const MCP_PROVIDERS: Record<McpProviderSlug, McpProvider> = {
  attio: {
    slug: "attio",
    displayName: "Attio",
    mcpServerUrl: "https://mcp.attio.com/mcp",
    oauthAuthorizationServerOrigins: ["https://app.attio.com"],
  },
  pylon: {
    slug: "pylon",
    displayName: "Pylon",
    // The MCP endpoint is the origin root (verified: POST / returns the
    // spec's 401 + WWW-Authenticate challenge; /mcp and /sse 404). OAuth is
    // discovered + dynamically registered (DCR) — no manual client creds.
    mcpServerUrl: "https://mcp.usepylon.com",
    oauthAuthorizationServerOrigins: ["https://o.auth.usepylon.com"],
  },
  hubspot: {
    slug: "hubspot",
    displayName: "HubSpot",
    // Verified: protected-resource + auth-server metadata advertise the auth
    // server as the MCP origin itself (authorize /oauth/authorize/user, token
    // /oauth/v3/token). No registration_endpoint (no DCR) and
    // token_endpoint_auth_methods_supported = ["client_secret_post"], so this
    // is a CONFIDENTIAL client — an admin must create a HubSpot "MCP auth app"
    // and store its client_id/secret (authMode: "manual").
    mcpServerUrl: "https://mcp.hubspot.com",
    oauthAuthorizationServerOrigins: ["https://mcp.hubspot.com"],
    authMode: "manual",
  },
  fathom: {
    slug: "fathom",
    displayName: "Fathom",
    // Verified: POST /mcp → 401 + WWW-Authenticate Bearer pointing at
    // /.well-known/oauth-protected-resource, which advertises the auth server
    // as https://api.fathom.ai. Auth-server metadata supports DCR
    // (registration_endpoint), PKCE S256, and a public client (auth method
    // "none") — so it's TAS-managed (no per-customer setup), like Attio.
    // Note: the token + registration endpoints are on api.fathom.ai, but the
    // authorization_endpoint is on fathom.video — both origins are allowed.
    mcpServerUrl: "https://api.fathom.ai/mcp",
    oauthAuthorizationServerOrigins: [
      "https://api.fathom.ai",
      "https://fathom.video",
    ],
  },
  dialed: {
    slug: "dialed",
    displayName: "Dialed",
    // Verified: POST https://dialed.day/mcp → 401 + WWW-Authenticate Bearer
    // pointing at /.well-known/oauth-protected-resource, which advertises the
    // auth server as the apex https://dialed.day. Auth-server metadata supports
    // DCR (registration_endpoint /oauth/register), PKCE S256, and a public
    // client (auth method "none") — so it's TAS-managed (no per-customer
    // setup), like Attio. (The www.dialed.day host is a non-OAuth PAT endpoint;
    // use the apex.)
    mcpServerUrl: "https://dialed.day/mcp",
    oauthAuthorizationServerOrigins: ["https://dialed.day"],
  },
  tembo: {
    slug: "tembo",
    displayName: "Tembo",
    // Self-key: no upstream OAuth. The connect flow branches before any
    // discovery, mints a per-user tas_ key, and stores the row pointing at
    // TAS's own /mcp (resolved via tasMcpServerUrl() at connect time). These
    // two fields are intentionally empty — the OAuth helpers never run for it.
    mcpServerUrl: "",
    oauthAuthorizationServerOrigins: [],
    authMode: "self-key",
  },
};

export function getMcpProvider(slug: string): McpProvider | null {
  return MCP_PROVIDERS[slug as McpProviderSlug] ?? null;
}

/**
 * The MCP server URL for the "self-key" Tembo provider — TAS's own /mcp
 * endpoint. Computed from the request/env-derived public origin rather than
 * baked into the catalog, then stored per-row in workspace_connection so it
 * can be tuned (e.g. to an internal URL) without code changes.
 */
export function tasMcpServerUrl(): string {
  return `${getPublicOrigin()}/mcp`;
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
