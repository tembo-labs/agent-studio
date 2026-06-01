import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, getWorkspaceRepo } from "@/lib/workspace";

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

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    redirect(`/onboarding/repo?ws=${encodeURIComponent(workspace.slug)}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <BackLink href={`/${workspace.slug}`} label="Agents" />
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          New agent
        </h1>
        <p className="text-foreground-weak text-base">
          Describe the agent in plain English. Tembo writes a valid agent
          file and opens a pull request against{" "}
          <span className="text-foreground font-medium">
            github.com/{repo.owner}/{repo.name}
          </span>{" "}
          on{" "}
          <code className="bg-surface rounded px-1 py-0.5 text-sm">
            {repo.defaultBranch}
          </code>{" "}
          for your team to review.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <NewAgentForm workspaceSlug={workspace.slug} />
    </div>
  );
}
