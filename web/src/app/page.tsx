import { redirect } from "next/navigation";

import { AuthSetupGuide } from "@/components/auth-setup-guide";
import { SetupInstanceNameForm } from "@/components/setup-instance-name-form";
import { SignInButtons } from "@/components/sign-in-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getConfiguredAuthProviders } from "@/lib/auth-providers";
import {
  getAppVersion,
  getInstanceNameFromEnv,
  POWERED_BY_HREF,
} from "@/lib/config";
import {
  getInstanceName,
  getStoredInstanceName,
  isFirstRun,
} from "@/lib/instance-settings";
import { resolvePendingInvitesForUserId } from "@/lib/invitations";
import { getServerSession } from "@/lib/session";
import { listWorkspacesForUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Sign-in lands back here with `?error=<code>` when an OAuth callback
// fails. The codes come from better-auth (e.g. `email_is_missing`), our
// invite-only gate, or the identity provider itself — all opaque to a
// first-time admin. Translate the common ones to actionable copy and
// always surface the raw code for support.
function describeAuthError(raw: string): string {
  const code = raw.toLowerCase();
  if (code.includes("invite")) {
    return "This instance is invite-only. Ask an admin to invite your email address, then try again.";
  }
  if (code.includes("email_is_missing") || code.includes("email_not_found")) {
    return "Your sign-in provider didn't share an email address. For Microsoft Entra, make sure the account has an email or UPN set, then try again.";
  }
  if (code.includes("oauth_code_verification_failed")) {
    return "Couldn't complete sign-in with your provider (token exchange failed). Check the provider's client secret and that the redirect URI matches this site.";
  }
  if (code.includes("unable_to_create_user")) {
    return "Your account couldn't be created. If this instance is invite-only, ask an admin to invite your email first.";
  }
  return `Sign-in failed (${raw}). If this instance is invite-only, ask an admin to invite your email.`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const session = await getServerSession();
  const instanceName = await getInstanceName();
  const { error } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;

  if (session) {
    // Auto-join any pending workspace invites for this account before
    // resolving where to land — covers users invited after they already
    // had an account (there's no separate "accept invite" step).
    try {
      await resolvePendingInvitesForUserId(session.user.id);
    } catch (e) {
      console.error("[invites] resolve on landing failed:", e);
    }
    const workspaces = await listWorkspacesForUser(session.user.id);
    if (workspaces.length === 0) {
      redirect("/onboarding");
    }
    redirect(`/${workspaces[0].slug}`);
  }

  const providers = getConfiguredAuthProviders();
  const firstRun = await isFirstRun();
  const version = getAppVersion();

  const signInCard =
    providers.length > 0 ? (
      <Card className="w-full max-w-md p-3">
        <CardHeader className="px-1 pb-3 pt-1">
          <CardTitle className="text-foreground-title text-base">
            Sign in
          </CardTitle>
        </CardHeader>
        <CardContent className="px-1 pb-1">
          <SignInButtons providers={providers} />
        </CardContent>
      </Card>
    ) : (
      <AuthSetupGuide />
    );

  return (
    <main className="bg-surface relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <h1 className="text-foreground-title text-center text-lg font-medium">
          {instanceName}
        </h1>

        {errorCode && (
          <div
            role="alert"
            className="border-sentiment-negative/30 bg-sentiment-negative/10 text-foreground w-full max-w-md rounded-lg border px-3 py-2 text-sm"
          >
            {describeAuthError(errorCode)}
          </div>
        )}

        {firstRun ? (
          <div className="flex w-full flex-col gap-4">
            <p className="text-foreground-weak text-center text-sm">
              First-run setup. Name this instance and configure a sign-in
              provider, then sign in to create the first workspace.
            </p>
            <Card className="w-full max-w-md p-3">
              <CardHeader className="px-1 pb-3 pt-1">
                <CardTitle className="text-foreground-title text-base">
                  Instance name
                </CardTitle>
              </CardHeader>
              <CardContent className="px-1 pb-1">
                <SetupInstanceNameForm
                  initialName={(await getStoredInstanceName()) ?? ""}
                  envFallback={getInstanceNameFromEnv()}
                />
              </CardContent>
            </Card>
            {signInCard}
          </div>
        ) : (
          signInCard
        )}
      </div>

      <p className="text-foreground-muted absolute bottom-4 right-4 text-sm">
        powered by{" "}
        <a
          href={POWERED_BY_HREF}
          target="_blank"
          rel="noreferrer noopener"
          className="hover:text-foreground-weak"
        >
          Tembo Agent Studio
        </a>
        {version && <span className="ml-1">{version}</span>}
      </p>
    </main>
  );
}
