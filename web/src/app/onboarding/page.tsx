import { redirect } from "next/navigation";

import { isInstanceAdminEmail } from "@/lib/config";
import { getInstanceName } from "@/lib/instance-settings";
import { getServerSession } from "@/lib/session";
import { listWorkspacesForUser } from "@/lib/workspace";

import { OnboardingForm } from "./onboarding-form";
import { SignOutLink } from "./sign-out-link";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const isAdmin = isInstanceAdminEmail(session.user.email);
  const workspaces = await listWorkspacesForUser(session.user.id);
  const instanceName = await getInstanceName();

  // Only instance admins create workspaces. A non-admin who already
  // belongs somewhere goes there; one who doesn't hits the invite-only
  // dead-end (in practice they wouldn't have an account without an
  // invite, which would have placed them in a workspace already).
  if (!isAdmin) {
    if (workspaces.length > 0) {
      redirect(`/${workspaces[0].slug}`);
    }
    return (
      <main className="bg-surface flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-6">
          <div className="space-y-1 text-center">
            <p className="text-foreground-weak text-sm font-medium uppercase tracking-widest">
              {instanceName}
            </p>
            <h1 className="text-foreground-title text-2xl font-semibold">
              You&apos;re not in a workspace yet
            </h1>
            <p className="text-foreground-weak text-base">
              This instance is invite-only. Ask an admin to invite{" "}
              <span className="text-foreground font-medium">
                {session.user.email}
              </span>{" "}
              to a workspace.
            </p>
          </div>
          <SignOutLink email={session.user.email} />
        </div>
      </main>
    );
  }

  const isFirst = workspaces.length === 0;

  return (
    <main className="bg-surface flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="space-y-1 text-center">
          <p className="text-foreground-weak text-sm font-medium uppercase tracking-widest">
            {instanceName}
          </p>
          <h1 className="text-foreground-title text-2xl font-semibold">
            {isFirst
              ? `Welcome, ${session.user.name ?? session.user.email}`
              : "Create a workspace"}
          </h1>
          <p className="text-foreground-weak text-base">
            A workspace pairs a Git repo with the team that uses it. You&apos;ll
            connect the repo next; API keys live in Settings.
          </p>
        </div>
        <OnboardingForm isFirst={isFirst} />
        <SignOutLink email={session.user.email} />
      </div>
    </main>
  );
}
