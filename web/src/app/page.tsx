import { AuthConfigNeeded } from "@/components/auth-config-needed";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { getApiHealth } from "@/lib/api";
import {
  POWERED_BY_HREF,
  getInstanceName,
  isGoogleConfigured,
} from "@/lib/config";
import { getServerSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession();
  const instanceName = getInstanceName();

  if (!session) {
    return (
      <main className="bg-surface relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <h1 className="text-foreground-title text-center text-lg font-medium">
            {instanceName}
          </h1>
          {isGoogleConfigured() ? (
            <Card className="w-full max-w-sm p-3">
              <CardHeader className="px-1 pb-3 pt-1">
                <CardTitle className="text-foreground-title text-base">
                  Sign in
                </CardTitle>
              </CardHeader>
              <CardContent className="px-1 pb-1">
                <GoogleSignInButton />
              </CardContent>
            </Card>
          ) : (
            <AuthConfigNeeded />
          )}
        </div>
        <p className="text-foreground-muted absolute bottom-4 right-4 text-xs">
          powered by{" "}
          <a
            href={POWERED_BY_HREF}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-foreground-weak"
          >
            Tembo Agent Studio
          </a>
        </p>
      </main>
    );
  }

  const health = await getApiHealth();
  const user = session.user;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-12 px-8 py-16">
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-foreground-weak text-xs font-medium uppercase tracking-widest">
            {instanceName}
          </p>
          <h1 className="text-foreground-title text-3xl font-semibold tracking-tight">
            v0.1 — foundation
          </h1>
          <p className="text-foreground-weak text-sm">
            Signed in as{" "}
            <span className="text-foreground font-medium">{user.email}</span>
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="space-y-3">
        <h2 className="text-foreground-weak text-sm font-medium uppercase tracking-wider">
          API health
        </h2>
        <pre className="bg-surface-raised border-border text-foreground overflow-x-auto rounded-lg border p-4 text-sm leading-6">
          {JSON.stringify(health, null, 2)}
        </pre>
      </section>
    </main>
  );
}
