import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  authProviderRedirectUri,
  getConfiguredAuthProviders,
} from "@/lib/auth-providers";
import { getPublicOrigin } from "@/lib/config";

const code =
  "bg-surface text-foreground rounded px-1 py-0.5 font-mono text-sm break-all";

type ProviderGuide = {
  id: string;
  name: string;
  /** social → /api/auth/callback/{id}; oauth2 → /api/auth/oauth2/callback/{id} */
  kind: "social" | "oauth2";
  docsHref: string;
  envVars: string[];
};

const GUIDES: ProviderGuide[] = [
  {
    id: "google",
    name: "Google",
    kind: "social",
    docsHref: "https://console.cloud.google.com/apis/credentials",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    id: "microsoft",
    name: "Microsoft (Entra ID)",
    kind: "oauth2",
    docsHref:
      "https://learn.microsoft.com/entra/identity-platform/quickstart-register-app",
    envVars: [
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
      "MICROSOFT_TENANT_ID (optional, default common)",
    ],
  },
  {
    id: "oidc",
    name: "OIDC — Okta, Auth0, Keycloak, …",
    kind: "oauth2",
    docsHref: "https://openid.net/developers/how-connect-works/",
    envVars: [
      "OIDC_CLIENT_ID",
      "OIDC_CLIENT_SECRET",
      "OIDC_DISCOVERY_URL",
      "OIDC_PROVIDER_NAME (optional label)",
    ],
  },
];

// Pre-sign-in guidance: pick a provider, set its env at the host,
// redeploy. Provider config is env-based (better-auth needs creds at
// startup), so this guides rather than writes. Shown when no provider
// is configured, and inside first-run setup.
export function AuthSetupGuide() {
  const origin = getPublicOrigin();
  const configured = new Set(getConfiguredAuthProviders().map((p) => p.id));

  return (
    <Card className="w-full max-w-md p-3">
      <CardHeader className="px-1 pb-2 pt-1">
        <CardTitle className="text-foreground-title text-base">
          Configure sign-in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-1 pb-1">
        <p className="text-foreground-weak text-sm">
          Set up at least one provider: register an app with the provider,
          add the redirect URI below, set the env vars at your host, and
          redeploy.
        </p>
        {GUIDES.map((g) => (
          <section key={g.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-foreground text-sm font-medium">
                {g.name}
              </span>
              {configured.has(g.id) && (
                <span className="text-sentiment-positive text-sm font-medium">
                  configured ✓
                </span>
              )}
            </div>
            <p className="text-foreground-weak text-sm">
              Redirect URI:{" "}
              <code className={code}>{authProviderRedirectUri(g, origin)}</code>
            </p>
            <p className="text-foreground-weak text-sm">
              Env:{" "}
              {g.envVars.map((v, i) => (
                <span key={v}>
                  {i > 0 && ", "}
                  <code className={code}>{v}</code>
                </span>
              ))}{" "}
              ·{" "}
              <a
                href={g.docsHref}
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground hover:underline"
              >
                docs
              </a>
            </p>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
