import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInstanceName } from "@/lib/config";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  userIsMember,
} from "@/lib/workspace";

import { NewAgentForm } from "./new-agent-form";

export const dynamic = "force-dynamic";

export default async function NewAgentPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    redirect(`/onboarding/repo?ws=${encodeURIComponent(workspace.slug)}`);
  }

  const instanceName = getInstanceName();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-8 py-16">
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-foreground-weak text-xs font-medium uppercase tracking-widest">
            {instanceName}
          </p>
          <div className="flex items-baseline gap-3">
            <Link
              href={`/${workspace.slug}`}
              className="text-foreground-weak hover:text-foreground text-sm"
            >
              {workspace.name}
            </Link>
            <span className="text-foreground-muted text-sm">/</span>
            <h1 className="text-foreground-title text-3xl font-semibold tracking-tight">
              New agent
            </h1>
          </div>
          <p className="text-foreground-weak text-sm">
            Will be committed to{" "}
            <span className="text-foreground font-medium">
              github.com/{repo.owner}/{repo.name}
            </span>{" "}
            on branch{" "}
            <code className="bg-surface text-foreground rounded px-1 py-0.5 text-xs">
              {repo.defaultBranch}
            </code>
            .
          </p>
        </div>
        <SignOutButton />
      </header>

      <Card className="p-3">
        <CardHeader className="flex-col items-start gap-1 px-1 pb-3 pt-1">
          <CardTitle className="text-foreground-title text-base">
            Create an agent
          </CardTitle>
          <CardDescription>
            Pick a starter template (Pydantic AgentSpec or Cargo AI), or
            paste your own definition. The file is committed directly to
            the connected repo on the default branch.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-1 pb-1">
          <NewAgentForm workspaceSlug={workspace.slug} />
        </CardContent>
      </Card>
    </main>
  );
}
