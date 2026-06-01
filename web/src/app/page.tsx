import { redirect } from "next/navigation";

import { AuthConfigNeeded } from "@/components/auth-config-needed";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { POWERED_BY_HREF, isGoogleConfigured } from "@/lib/config";
import { getInstanceName } from "@/lib/instance-settings";
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
