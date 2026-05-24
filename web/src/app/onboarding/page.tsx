import { redirect } from "next/navigation";

import { getInstanceName } from "@/lib/config";
import { getServerSession } from "@/lib/session";
import { listWorkspacesForUser } from "@/lib/workspace";

import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const workspaces = await listWorkspacesForUser(session.user.id);
  if (workspaces.length > 0) {
    redirect(`/${workspaces[0].slug}`);
  }

  const instanceName = getInstanceName();

  return (
    <main className="bg-surface flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="space-y-1 text-center">
          <p className="text-foreground-weak text-xs font-medium uppercase tracking-widest">
            {instanceName}
          </p>
          <h1 className="text-foreground-title text-lg font-medium">
            Welcome, {session.user.name ?? session.user.email}
          </h1>
          <p className="text-foreground-weak text-sm">
            A workspace pairs a Git repo and a Tembo API key with the team that
            uses them. You&apos;ll add those next.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </main>
  );
}
