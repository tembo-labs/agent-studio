import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const codeClass =
  "bg-surface text-foreground rounded px-1 py-0.5 font-mono text-xs";

export function AuthConfigNeeded() {
  return (
    <Card className="w-full max-w-md p-3">
      <CardHeader className="px-1 pb-3 pt-1">
        <CardTitle className="text-foreground-title text-base">
          Configuration needed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-1 pb-1">
        <section className="space-y-2">
          <p className="text-foreground text-sm font-medium">
            Enable Google sign-in
          </p>
          <ol className="text-foreground-weak list-decimal space-y-2 pl-4 text-sm leading-6">
            <li>
              Create an OAuth 2.0 client in the{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground hover:underline"
              >
                Google Cloud Console
              </a>
              .
            </li>
            <li>
              Add{" "}
              <code className={codeClass}>
                http://localhost:3001/api/auth/callback/google
              </code>{" "}
              as an authorized redirect URI.
            </li>
            <li>
              Set <code className={codeClass}>GOOGLE_CLIENT_ID</code> and{" "}
              <code className={codeClass}>GOOGLE_CLIENT_SECRET</code> in{" "}
              <code className={codeClass}>.env</code>.
            </li>
            <li>
              Run <code className={codeClass}>docker compose up -d</code> to
              pick up the new env.
            </li>
          </ol>
        </section>

        <hr className="border-border" />

        <section className="space-y-2">
          <p className="text-foreground text-sm font-medium">
            Prefer a different provider?
          </p>
          <p className="text-foreground-weak text-base leading-6">
            Edit <code className={codeClass}>socialProviders</code> in{" "}
            <code className={codeClass}>web/src/lib/auth.ts</code>. better-auth
            ships native support for GitHub, Microsoft (Entra ID / Azure AD),
            Apple, Discord, Twitter, LinkedIn, and Spotify, plus a generic
            OIDC adapter for Okta, Auth0, Keycloak, and other IdPs.
          </p>
          <ul className="text-foreground-weak space-y-1 text-sm leading-6">
            <li>
              GitHub —{" "}
              <a
                href="https://www.better-auth.com/docs/authentication/github"
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground hover:underline"
              >
                docs
              </a>
            </li>
            <li>
              Microsoft (Azure AD / Entra ID) —{" "}
              <a
                href="https://www.better-auth.com/docs/authentication/microsoft"
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground hover:underline"
              >
                docs
              </a>
            </li>
            <li>
              Okta / Auth0 / Keycloak via generic OIDC —{" "}
              <a
                href="https://www.better-auth.com/docs/plugins/generic-oauth"
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground hover:underline"
              >
                docs
              </a>
            </li>
          </ul>
          <p className="text-foreground-muted text-sm">
            Add the provider&apos;s env vars to{" "}
            <code className={codeClass}>.env</code> and{" "}
            <code className={codeClass}>docker-compose.yml</code> so they reach
            the web container.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
