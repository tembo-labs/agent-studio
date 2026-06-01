import { redirect } from "next/navigation";

import { AuthSetupGuide } from "@/components/auth-setup-guide";
import { SetupInstanceNameForm } from "@/components/setup-instance-name-form";
import { SignInButtons } from "@/components/sign-in-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getConfiguredAuthProviders } from "@/lib/auth-providers";
import { getInstanceNameFromEnv, POWERED_BY_HREF } from "@/lib/config";
import {
  getInstanceName,
  getStoredInstanceName,
  isFirstRun,
} from "@/lib/instance-settings";
import { getServerSession } from "@/lib/session";
import { listWorkspacesForUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession();
  const instanceName = await getInstanceName();

  if (session) {
    const workspaces = await listWorkspacesForUser(session.user.id);
    if (workspaces.length === 0) {
      redirect("/onboarding");
    }
    redirect(`/${workspaces[0].slug}`);
  }

  const providers = getConfiguredAuthProviders();
  const firstRun = await isFirstRun();

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
      </p>
    </main>
  );
}
