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
  | "linear"
  | "amplemarket"
  | "clay"
  | "avoma"
  | "metabase"
  | "gmail"
  | "notion"
  | "intercom"
  | "atlassian"
  | "asana"
  | "monday"
  | "guru"
  | "fireflies"
  | "amplitude"
  | "apollo"
  | "posthog"
  | "stripe"
  | "github"
  | "twitter"
  // Batch 2026-07: hosted OAuth MCP servers harvested from Anthropic
  // knowledge-work-plugins + live /.well-known OAuth probes (DCR public unless noted).
  | "vercel"
  | "canva"
  | "clickup"
  | "close"
  | "sentry"
  | "mixpanel"
  | "granola"
  | "dropbox"
  | "webflow"
  | "cloudflare"
  | "neon"
  | "cal"
  | "klaviyo"
  | "paypal"
  | "square"
  | "airtable"
  | "railway"
  | "resend"
  | "hex"
  | "pendo"
  | "similarweb"
  | "datadog"
  | "commonroom"
  | "gong"
  | "box"
  | "pagerduty"
  | "slack"
  | "zoom"
  | "tembo-agent-studio";

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
   *  - "pat": static bearer / personal access token the user pastes at
   *    Connect time (no OAuth). Used when the provider's hosted MCP only
   *    supports API keys / PATs (GitHub remote MCP, X app-only Bearer).
   */
  authMode?: "dcr" | "manual" | "self-key" | "pat";
  /**
   * Help text for `authMode: "pat"` — where to mint the token and which
   * scopes/presets to pick. Shown next to the token field on Connect.
   */
  patHint?: string;
  /**
   * Extra static query params appended to the /authorize redirect, verbatim.
   * Some auth servers need provider-specific params the MCP spec doesn't model
   * — e.g. Google only returns a refresh_token when the request carries
   * `access_type=offline` + `prompt=consent`.
   */
  authorizeParams?: Record<string, string>;
  /**
   * Request these exact scopes instead of the resource's advertised
   * `scopes_supported`. Lets us NARROW an over-broad advertised set — e.g.
   * Gmail advertises full-mailbox `https://mail.google.com/`, but we only want
   * readonly + compose.
   */
  scopeOverride?: string[];
  /**
   * Suppress the OIDC `offline_access` scope that TAS otherwise appends for DCR
   * providers whose auth server advertises the `refresh_token` grant. Most
   * servers accept the unknown scope leniently (Attio/Dialed even REQUIRE it to
   * mint a refresh token and don't advertise it), but some STRICTLY validate the
   * request against their `scopes_supported` and reject `offline_access` with
   * "invalid scope", which is fatal to the whole authorize. Amplemarket is the
   * first of these (advertises only mcp:read/mcp:write). Such servers either mint
   * refresh tokens without the scope or issue short-lived-only access tokens.
   */
  omitOfflineAccess?: boolean;
  /**
   * Provider-specific note shown on the connection (detail view + the API-key
   * edit field) explaining why/when a supplementary API key is needed and which
   * scopes it requires. Set for providers whose MCP OAuth can't do privileged
   * ops (Attio: no record/note/delete scopes). Plain text.
   */
  auxKeyHint?: string;
  /**
   * Set for INSTANCE-BASED providers whose MCP server is self-hosted, so the
   * host isn't a fixed constant — the user supplies it at Connect time. The
   * template's `{instance}` is replaced with the user's host to form the MCP
   * URL (e.g. Metabase: `https://{instance}/api/metabase-mcp`). For these,
   * `mcpServerUrl`/`oauthAuthorizationServerOrigins` are empty: the per-connection
   * URL is resolved + stored on the row, and OAuth trust is same-origin (every
   * discovered endpoint must share the user-entered origin) rather than a fixed
   * allowlist. Still SSRF-guarded (https + public-DNS, same as other providers).
   */
  instanceUrlTemplate?: string;
  /** UI hint for the instance-URL field on instance-based providers. */
  instanceUrlLabel?: string;
};

export const MCP_PROVIDERS: Record<McpProviderSlug, McpProvider> = {
  attio: {
    slug: "attio",
    displayName: "Attio",
    mcpServerUrl: "https://mcp.attio.com/mcp",
    oauthAuthorizationServerOrigins: ["https://app.attio.com"],
    // Attio's MCP OAuth grants only mcp/offline_access/openid — no record/note/
    // delete scopes — so agents can't write through the connection token alone.
    auxKeyHint:
      "Attio's MCP login can't write. To let agents create notes or update/delete records, add an Attio access token (Attio → Settings → Developers) with note_content:read-write, record_permission:read-write, and the delete scopes — agents use it via tas_tools.connection(\"attio\").api_key.",
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
  linear: {
    slug: "linear",
    displayName: "Linear",
    // Verified (probe): POST https://mcp.linear.app/mcp → 401 + WWW-Authenticate
    // Bearer → /.well-known/oauth-protected-resource/mcp advertises the auth
    // server as https://mcp.linear.app. Auth-server metadata exposes a
    // registration_endpoint (/register → DCR), PKCE S256, and a public client
    // (token auth method "none") with read+write scopes — TAS-managed, no
    // per-customer setup, like Attio. Docs: https://linear.app/docs/mcp
    mcpServerUrl: "https://mcp.linear.app/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.linear.app"],
  },
  amplemarket: {
    slug: "amplemarket",
    displayName: "Amplemarket",
    // Verified (probe): POST https://mcp.amplemarket.com/mcp → 401 + WWW-Authenticate
    // Bearer → /.well-known/oauth-protected-resource advertises the auth server as
    // https://app.amplemarket.com (scopes mcp:read, mcp:write). Auth-server metadata
    // exposes a registration_endpoint (/oauth/register → DCR), PKCE S256, and a public
    // client (token auth method "none") — TAS-managed, no per-customer setup, like Attio.
    mcpServerUrl: "https://mcp.amplemarket.com/mcp",
    oauthAuthorizationServerOrigins: ["https://app.amplemarket.com"],
    // Strictly validates scope against scopes_supported (mcp:read/mcp:write) and
    // rejects the auto-appended offline_access with "invalid scope" — suppress it.
    omitOfflineAccess: true,
  },
  clay: {
    slug: "clay",
    displayName: "Clay",
    // Verified (probe): POST https://api.clay.com/v3/mcp → 401; protected-resource
    // metadata is served PATH-SUFFIXED (/.well-known/oauth-protected-resource/v3/mcp;
    // the bare origin 404s — handled by the suffixed-discovery fallback) and advertises
    // the auth server as https://api.clay.com (scope "mcp"). Auth-server metadata exposes
    // a registration_endpoint (/oauth/register → DCR), PKCE S256, and a public client
    // (token auth method "none") — TAS-managed, no per-customer setup, like Attio. The
    // authorize endpoint lives on a SEPARATE origin (app.clay.com) from token/registration
    // (api.clay.com) — both origins are allowed, like Fathom. offline_access kept (default):
    // the authorize endpoint is a client-rendered app that doesn't reject unknown scopes at
    // the GET, unlike Amplemarket.
    mcpServerUrl: "https://api.clay.com/v3/mcp",
    oauthAuthorizationServerOrigins: [
      "https://api.clay.com",
      "https://app.clay.com",
    ],
  },
  avoma: {
    slug: "avoma",
    displayName: "Avoma",
    // Verified (probe): POST https://mcp.avoma.com/mcp → 401 → protected-resource
    // advertises the auth server https://prod-api.avoma.com. Auth-server metadata
    // exposes a registration_endpoint (/oauth/register → DCR), PKCE S256, and the
    // refresh_token grant — TAS-managed, like Attio.
    // The protected-resource does NOT advertise scopes_supported, so the
    // external_api scopes (which live on the auth-server metadata) must be
    // requested explicitly via scopeOverride. offline_access is kept (the
    // authorize endpoint doesn't reject it). NOTE: Avoma's DCR issues a
    // client_secret; TAS's DCR exchange is public/PKCE-only — if Avoma requires
    // the secret at /oauth/token, connect will need DCR-confidential support.
    mcpServerUrl: "https://mcp.avoma.com/mcp",
    oauthAuthorizationServerOrigins: ["https://prod-api.avoma.com"],
    scopeOverride: [
      "external_api:meetings-list",
      "external_api:meetings-detail",
      "external_api:meetings-set-purpose",
      "external_api:meetings-set-outcome",
      "external_api:meetings-set-privacy",
      "external_api:meeting_type-list",
      "external_api:meeting_outcome-list",
      "external_api:teams-list",
      "external_api:deal_stages-list",
      "external_api:transcriptions-list",
      "external_api:notes-list",
      "external_api:scorecard_evaluations-list",
      "external_api:engagement-list",
    ],
  },
  metabase: {
    slug: "metabase",
    displayName: "Metabase",
    // Instance-based: Metabase is self-hosted, so the MCP server is the user's
    // own instance + the fixed path /api/metabase-mcp. Metabase runs its OWN
    // embedded OAuth (DCR, same-origin), scoped to the connecting person's
    // permissions — so it slots into the DCR / confidential-DCR path; trust is
    // same-origin (the user's instance), not a fixed allowlist.
    // Docs: https://www.metabase.com/docs/latest/ai/mcp
    mcpServerUrl: "",
    oauthAuthorizationServerOrigins: [],
    instanceUrlTemplate: "https://{instance}/api/metabase-mcp",
    instanceUrlLabel: "Your Metabase URL",
    // Metabase advertises the refresh_token grant but its scopes_supported is
    // agent:* + mb:full — NO offline_access. It strictly validates the scope at
    // the (post-login) authorize step and rejects the auto-appended offline_access
    // with "invalid_request", so suppress it.
    omitOfflineAccess: true,
  },
  gmail: {
    slug: "gmail",
    displayName: "Gmail",
    // Google Workspace Gmail MCP. Verified (probe): protected-resource metadata
    // is served only PATH-SUFFIXED (…/oauth-protected-resource/mcp/v1; the bare
    // origin 404s — handled by the suffixed-discovery fallback) and advertises
    // accounts.google.com as the auth server, whose token endpoint sits on a
    // SEPARATE origin (oauth2.googleapis.com) — both trusted below. Standard
    // Google OAuth: no DCR; a CONFIDENTIAL client an admin creates in Google
    // Cloud (authMode "manual", like HubSpot). access_type=offline +
    // prompt=consent are required for a refresh_token; scope is the single
    // full-access mail.google.com (see the scopeOverride note below).
    // Docs: https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server
    mcpServerUrl: "https://gmailmcp.googleapis.com/mcp/v1",
    oauthAuthorizationServerOrigins: [
      "https://accounts.google.com",
      "https://oauth2.googleapis.com",
    ],
    authMode: "manual",
    authorizeParams: { access_type: "offline", prompt: "consent" },
    // Request the single full-access Gmail scope. readonly+compose yielded
    // "caller does not have permission" from the gmailmcp tools (the server
    // gates its tools on a broader grant than the data scope alone), and a
    // single scope also avoids Google's granular-consent partial grants (one
    // checkbox, not several the user can half-grant). The token only carries
    // what WE request here — what's enabled on the consent screen is moot
    // unless it's in this list.
    scopeOverride: ["https://mail.google.com/"],
  },
  // ── Batch sourced from anthropics/knowledge-work-plugins .mcp.json ──
  // Endpoints + DCR support confirmed by probing each server's
  // /.well-known/oauth-authorization-server (registration_endpoint present,
  // auth server == MCP origin). Public DCR like Attio — no per-customer setup.
  // offline_access handling is left at the default; if a server strictly
  // validates and rejects it at Connect, add omitOfflineAccess reactively
  // (as done for Amplemarket/Metabase). Connect-verify each on the dogfood
  // instance before relying on it.
  notion: {
    slug: "notion",
    displayName: "Notion",
    mcpServerUrl: "https://mcp.notion.com/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.notion.com"],
  },
  intercom: {
    slug: "intercom",
    displayName: "Intercom",
    mcpServerUrl: "https://mcp.intercom.com/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.intercom.com"],
  },
  atlassian: {
    slug: "atlassian",
    displayName: "Atlassian (Jira)",
    // Auth + token/registration split across mcp.atlassian.com and its
    // cf. subdomain — both trusted.
    mcpServerUrl: "https://mcp.atlassian.com/v1/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.atlassian.com",
      "https://cf.mcp.atlassian.com",
    ],
  },
  asana: {
    slug: "asana",
    displayName: "Asana",
    mcpServerUrl: "https://mcp.asana.com/v2/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.asana.com"],
  },
  monday: {
    slug: "monday",
    displayName: "monday.com",
    mcpServerUrl: "https://mcp.monday.com/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.monday.com"],
  },
  guru: {
    slug: "guru",
    displayName: "Guru",
    mcpServerUrl: "https://mcp.api.getguru.com/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.api.getguru.com"],
  },
  fireflies: {
    slug: "fireflies",
    displayName: "Fireflies",
    mcpServerUrl: "https://api.fireflies.ai/mcp",
    oauthAuthorizationServerOrigins: ["https://api.fireflies.ai"],
  },
  amplitude: {
    slug: "amplitude",
    displayName: "Amplitude",
    // Advertises offline_access in scopes_supported, so the default append is fine.
    mcpServerUrl: "https://mcp.amplitude.com/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.amplitude.com"],
  },
  apollo: {
    slug: "apollo",
    displayName: "Apollo",
    mcpServerUrl: "https://mcp.apollo.io/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.apollo.io"],
  },
  posthog: {
    slug: "posthog",
    displayName: "PostHog",
    // Official hosted MCP. Protected-resource metadata advertises
    // oauth.posthog.com as the auth server (region-routes US/EU from the
    // account you sign in with). DCR + PKCE public client; refresh_token grant
    // is advertised but offline_access is NOT in scopes_supported — suppress
    // the auto-append so strict scope validation doesn't reject Connect.
    // Docs: https://posthog.com/docs/model-context-protocol
    mcpServerUrl: "https://mcp.posthog.com/mcp",
    oauthAuthorizationServerOrigins: ["https://oauth.posthog.com"],
    omitOfflineAccess: true,
  },
  stripe: {
    slug: "stripe",
    displayName: "Stripe",
    // Hosted MCP at mcp.stripe.com. PR metadata advertises auth server
    // https://access.stripe.com/mcp (path-aware AS discovery); DCR public
    // client + PKCE S256 + refresh_token. Scope is the single "mcp" grant —
    // offline_access is not advertised, so suppress the auto-append.
    // Docs: https://docs.stripe.com/mcp
    mcpServerUrl: "https://mcp.stripe.com",
    oauthAuthorizationServerOrigins: [
      "https://access.stripe.com",
      "https://mcp.stripe.com",
    ],
    scopeOverride: ["mcp"],
    omitOfflineAccess: true,
  },
  github: {
    slug: "github",
    displayName: "GitHub",
    // Hosted remote MCP (api.githubcopilot.com). GitHub's auth server has no
    // DCR and incomplete OAuth metadata for third-party hosts — connect with
    // a fine-grained or classic PAT (Bearer), matching GitHub's documented
    // non-OAuth path. Docs: https://github.com/github/github-mcp-server
    mcpServerUrl: "https://api.githubcopilot.com/mcp/",
    oauthAuthorizationServerOrigins: [],
    authMode: "pat",
    patHint:
      "Paste a GitHub personal access token with the scopes your agent needs (repo, read:org, …). Classic or fine-grained both work as a Bearer token against the remote GitHub MCP server.",
  },
  twitter: {
    slug: "twitter",
    displayName: "X",
    // Official hosted X API MCP. No MCP OAuth discovery / DCR — use an
    // App-only Bearer from the X Developer Portal (read tools; user-context
    // writes need the xurl bridge outside TAS). Docs: https://docs.x.com/tools/mcp
    mcpServerUrl: "https://api.x.com/mcp",
    oauthAuthorizationServerOrigins: [],
    authMode: "pat",
    patHint:
      "Paste your X app's App-only Bearer token (Developer Portal → your app → Keys and tokens). This grants app-level read access; it does not post as a user.",
  },
  // ── Hosted OAuth MCP batch (knowledge-work-plugins + OAuth probe) ──
  // Each verified: protected-resource metadata + DCR public client (token
  // auth method "none") + PKCE S256, unless authMode is "manual". omitOfflineAccess
  // when offline_access is not in scopes_supported (strict validators).
  vercel: {
    slug: "vercel",
    displayName: "Vercel",
    mcpServerUrl: "https://mcp.vercel.com",
    oauthAuthorizationServerOrigins: [
      "https://mcp.vercel.com",
      "https://vercel.com",
    ],
  },
  canva: {
    slug: "canva",
    displayName: "Canva",
    mcpServerUrl: "https://mcp.canva.com/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.canva.com"],
    omitOfflineAccess: true,
  },
  clickup: {
    slug: "clickup",
    displayName: "ClickUp",
    // Auth-code only (no refresh_token grant advertised).
    mcpServerUrl: "https://mcp.clickup.com/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.clickup.com"],
    omitOfflineAccess: true,
  },
  close: {
    slug: "close",
    displayName: "Close",
    mcpServerUrl: "https://mcp.close.com/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.close.com",
      "https://api.close.com",
      "https://app.close.com",
    ],
  },
  sentry: {
    slug: "sentry",
    displayName: "Sentry",
    mcpServerUrl: "https://mcp.sentry.dev/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.sentry.dev"],
    omitOfflineAccess: true,
  },
  mixpanel: {
    slug: "mixpanel",
    displayName: "Mixpanel",
    mcpServerUrl: "https://mcp.mixpanel.com/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.mixpanel.com",
      "https://mixpanel.com",
    ],
    omitOfflineAccess: true,
  },
  granola: {
    slug: "granola",
    displayName: "Granola",
    mcpServerUrl: "https://mcp.granola.ai/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.granola.ai",
      "https://mcp-auth.granola.ai",
    ],
  },
  dropbox: {
    slug: "dropbox",
    displayName: "Dropbox",
    mcpServerUrl: "https://mcp.dropbox.com/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.dropbox.com",
      "https://www.dropbox.com",
      "https://api.dropboxapi.com",
    ],
    omitOfflineAccess: true,
  },
  webflow: {
    slug: "webflow",
    displayName: "Webflow",
    mcpServerUrl: "https://mcp.webflow.com/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.webflow.com"],
    omitOfflineAccess: true,
  },
  cloudflare: {
    slug: "cloudflare",
    displayName: "Cloudflare",
    mcpServerUrl: "https://mcp.cloudflare.com/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.cloudflare.com"],
    omitOfflineAccess: true,
  },
  neon: {
    slug: "neon",
    displayName: "Neon",
    mcpServerUrl: "https://mcp.neon.tech/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.neon.tech"],
    omitOfflineAccess: true,
  },
  cal: {
    slug: "cal",
    displayName: "Cal.com",
    mcpServerUrl: "https://mcp.cal.com/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.cal.com"],
    omitOfflineAccess: true,
  },
  klaviyo: {
    slug: "klaviyo",
    displayName: "Klaviyo",
    mcpServerUrl: "https://mcp.klaviyo.com/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.klaviyo.com"],
    omitOfflineAccess: true,
  },
  paypal: {
    slug: "paypal",
    displayName: "PayPal",
    mcpServerUrl: "https://mcp.paypal.com/sse",
    oauthAuthorizationServerOrigins: ["https://mcp.paypal.com"],
    omitOfflineAccess: true,
  },
  square: {
    slug: "square",
    displayName: "Square",
    mcpServerUrl: "https://mcp.squareup.com/sse",
    oauthAuthorizationServerOrigins: ["https://mcp.squareup.com"],
    omitOfflineAccess: true,
  },
  airtable: {
    slug: "airtable",
    displayName: "Airtable",
    mcpServerUrl: "https://mcp.airtable.com/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.airtable.com",
      "https://airtable.com",
    ],
    omitOfflineAccess: true,
  },
  railway: {
    slug: "railway",
    displayName: "Railway",
    mcpServerUrl: "https://mcp.railway.app/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.railway.app",
      "https://backboard.railway.com",
    ],
  },
  resend: {
    slug: "resend",
    displayName: "Resend",
    mcpServerUrl: "https://mcp.resend.com/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.resend.com",
      "https://api.resend.com",
    ],
    omitOfflineAccess: true,
  },
  hex: {
    slug: "hex",
    displayName: "Hex",
    mcpServerUrl: "https://app.hex.tech/mcp",
    oauthAuthorizationServerOrigins: [
      "https://app.hex.tech",
      "https://auth.app.hex.tech",
    ],
  },
  pendo: {
    slug: "pendo",
    displayName: "Pendo",
    mcpServerUrl: "https://app.pendo.io/mcp/v0/shttp",
    oauthAuthorizationServerOrigins: ["https://app.pendo.io"],
    omitOfflineAccess: true,
  },
  similarweb: {
    slug: "similarweb",
    displayName: "Similarweb",
    mcpServerUrl: "https://mcp.similarweb.com/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.similarweb.com",
      "https://mcp-auth.similarweb.com",
    ],
    omitOfflineAccess: true,
  },
  datadog: {
    slug: "datadog",
    displayName: "Datadog",
    mcpServerUrl: "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.datadoghq.com",
      "https://app.datadoghq.com",
    ],
    omitOfflineAccess: true,
  },
  commonroom: {
    slug: "commonroom",
    displayName: "Common Room",
    mcpServerUrl: "https://mcp.commonroom.io/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.commonroom.io",
      "https://login.commonroom.io",
    ],
  },
  // Manual (BYO confidential OAuth app) — popular hosted MCPs without DCR.
  gong: {
    slug: "gong",
    displayName: "Gong",
    mcpServerUrl: "https://mcp.gong.io/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.gong.io",
      "https://app.gong.io",
    ],
    authMode: "manual",
  },
  box: {
    slug: "box",
    displayName: "Box",
    mcpServerUrl: "https://mcp.box.com",
    oauthAuthorizationServerOrigins: [
      "https://mcp.box.com",
      "https://api.box.com",
      "https://account.box.com",
    ],
    authMode: "manual",
  },
  pagerduty: {
    slug: "pagerduty",
    displayName: "PagerDuty",
    mcpServerUrl: "https://mcp.pagerduty.com/mcp",
    oauthAuthorizationServerOrigins: [
      "https://mcp.pagerduty.com",
      "https://app.pagerduty.com",
    ],
    authMode: "manual",
  },
  slack: {
    slug: "slack",
    displayName: "Slack",
    // Hosted MCP; confidential OAuth only (no DCR). Docs:
    // https://docs.slack.dev/ai/slack-mcp-server
    mcpServerUrl: "https://mcp.slack.com/mcp",
    oauthAuthorizationServerOrigins: ["https://mcp.slack.com", "https://slack.com"],
    authMode: "manual",
  },
  zoom: {
    slug: "zoom",
    displayName: "Zoom",
    // Hosted streamable MCP (meetings / recordings / hub). Auth is Zoom's
    // standard OAuth AS (https://zoom.us) — no DCR, client_secret_basic only
    // (not post), PKCE not advertised. Manual BYO app; authorize picks Basic
    // from token_endpoint_auth_methods_supported. Docs:
    // https://developers.zoom.us/docs/guides/tools-and-extensions/mcp/
    mcpServerUrl: "https://mcp.zoom.us/mcp/zoom/streamable",
    oauthAuthorizationServerOrigins: [
      "https://zoom.us",
      "https://mcp.zoom.us",
      "https://mcp-us.zoom.us",
    ],
    authMode: "manual",
  },
  "tembo-agent-studio": {
    slug: "tembo-agent-studio",
    displayName: "Tembo Agent Studio",
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
 * Whether a provider uses the TAS-managed DCR path — `authMode` "dcr" OR unset,
 * since "dcr" is the documented default and most catalog entries omit it.
 * Excludes "manual" (BYO confidential app) and "self-key" (Tembo). This is the
 * "is this connection editable / can it hold a supplementary API key" predicate;
 * checking `authMode === "dcr"` literally is a bug — it misses every default-DCR
 * provider (Attio, Pylon, Fathom, Dialed, Linear, Amplemarket).
 */
export function isDcrProvider(provider: McpProvider | null | undefined): boolean {
  return (
    !!provider &&
    provider.authMode !== "manual" &&
    provider.authMode !== "self-key" &&
    provider.authMode !== "pat"
  );
}

/** Instance-based providers (self-hosted; user supplies the host at Connect). */
export function isInstanceProvider(
  provider: McpProvider | null | undefined,
): boolean {
  return !!provider?.instanceUrlTemplate;
}

/**
 * Resolve an instance-based provider's MCP URL from the user's input. Takes the
 * origin of whatever they entered (bare host or full URL) and applies the
 * template's fixed path. Returns null if the input can't be parsed as a URL.
 * https-ness / public-IP are enforced later by the OAuth security layer.
 */
export function resolveInstanceMcpUrl(
  provider: McpProvider,
  input: string,
): string | null {
  if (!provider.instanceUrlTemplate) return null;
  const raw = input.trim();
  if (!raw) return null;
  let origin: string;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    origin = new URL(withScheme).origin;
  } catch {
    return null;
  }
  // Everything in the template after `https://{instance}` is the fixed path.
  const path = provider.instanceUrlTemplate.replace(
    /^https?:\/\/\{instance\}/i,
    "",
  );
  return `${origin}${path}`;
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
