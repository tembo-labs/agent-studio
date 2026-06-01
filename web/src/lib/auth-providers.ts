import "server-only";

// Configured sign-in providers, derived from env (each provider is
// enabled by the presence of its credentials, like Google has always
// been). Google is a built-in better-auth social provider; Microsoft
// (Entra ID) and a generic OIDC provider both go through the
// genericOAuth plugin (Microsoft = a known Entra discovery URL).
//
// Pure env reads, server-only. The login page calls
// getConfiguredAuthProviders() and passes the plain list to the client
// button component (so the client never imports this module).

export type AuthProviderKind = "social" | "oauth2";

export type AuthProvider = {
  /** better-auth provider id / genericOAuth providerId. */
  id: string;
  label: string;
  /** social → authClient.signIn.social; oauth2 → signIn.oauth2 (genericOAuth). */
  kind: AuthProviderKind;
};

function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

function microsoftConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
  );
}

function oidcConfigured(): boolean {
  return Boolean(
    process.env.OIDC_CLIENT_ID &&
      process.env.OIDC_CLIENT_SECRET &&
      process.env.OIDC_DISCOVERY_URL,
  );
}

/** Entra ID OIDC discovery URL for the configured tenant. */
export function microsoftDiscoveryUrl(): string {
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() || "common";
  return `https://login.microsoftonline.com/${tenant}/v2.0/.well-known/openid-configuration`;
}

export function getConfiguredAuthProviders(): AuthProvider[] {
  const out: AuthProvider[] = [];
  if (googleConfigured()) {
    out.push({ id: "google", label: "Google", kind: "social" });
  }
  if (microsoftConfigured()) {
    out.push({ id: "microsoft", label: "Microsoft", kind: "oauth2" });
  }
  if (oidcConfigured()) {
    out.push({
      id: "oidc",
      label: process.env.OIDC_PROVIDER_NAME?.trim() || "SSO",
      kind: "oauth2",
    });
  }
  return out;
}

export function isAnyAuthConfigured(): boolean {
  return getConfiguredAuthProviders().length > 0;
}

export type GenericOAuthProviderConfig = {
  providerId: string;
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
};

/** genericOAuth plugin config entries (Microsoft + generic OIDC). */
export function genericOAuthConfigs(): GenericOAuthProviderConfig[] {
  const configs: GenericOAuthProviderConfig[] = [];
  if (microsoftConfigured()) {
    configs.push({
      providerId: "microsoft",
      discoveryUrl: microsoftDiscoveryUrl(),
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      scopes: ["openid", "profile", "email"],
    });
  }
  if (oidcConfigured()) {
    configs.push({
      providerId: "oidc",
      discoveryUrl: process.env.OIDC_DISCOVERY_URL!,
      clientId: process.env.OIDC_CLIENT_ID!,
      clientSecret: process.env.OIDC_CLIENT_SECRET!,
      scopes: (process.env.OIDC_SCOPES?.trim() || "openid profile email").split(
        /\s+/,
      ),
    });
  }
  return configs;
}
