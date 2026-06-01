import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInstanceName } from "@/lib/instance-settings";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  listWorkspacesForUser,
  userIsMember,
} from "@/lib/workspace";

import { SignOutLink } from "../sign-out-link";

import { ConnectRepoForm } from "./connect-repo-form";

export const dynamic = "force-dynamic";

export default async function OnboardingRepoPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const { ws } = await searchParams;

  const session = await getServerSession();
  if (!session) redirect("/");

  // ws param tells us which workspace we're connecting a repo to. If it
  // isn't provided, recover by picking the user's first workspace; if they
  // have none, send them through name-creation first.
  let slug = ws;
  if (!slug) {
    const list = await listWorkspacesForUser(session.user.id);
    if (list.length === 0) redirect("/onboarding");
    slug = list[0].slug;
  }

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) redirect("/onboarding");

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) redirect("/");

  const existing = await getWorkspaceRepo(workspace.id);
  if (existing) {
    // Already connected — disconnect from settings if you want to swap it.
    redirect(`/${workspace.slug}`);
  }

  const instanceName = await getInstanceName();

  return (
    <main className="bg-surface flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="space-y-1 text-center">
          <p className="text-foreground-weak text-xs font-medium uppercase tracking-widest">
            {instanceName}
          </p>
          <h1 className="text-foreground-title text-lg font-medium">
            Connect a Git repository
          </h1>
          <p className="text-foreground-weak text-sm">
            One repo per workspace. Agent definitions are committed here and
            reviewed like any other code in your org.
          </p>
        </div>
        <Card className="w-full max-w-md p-3">
          <CardHeader className="flex-col items-start gap-1 px-1 pb-3 pt-1">
            <CardTitle className="text-foreground-title text-base">
              {workspace.name}
            </CardTitle>
            <CardDescription>
              We&apos;ll validate read + write access against the GitHub API
              before saving anything.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-1 pb-1">
            <ConnectRepoForm workspaceSlug={workspace.slug} />
          </CardContent>
        </Card>
        <SignOutLink email={session.user.email} />
      </div>
    </main>
  );
}
