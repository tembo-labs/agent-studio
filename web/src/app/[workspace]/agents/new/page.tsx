import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { getLibraryAgent } from "@/lib/agent-library";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, getWorkspaceRepo } from "@/lib/workspace";

import { NewAgentForm } from "./new-agent-form";

export const dynamic = "force-dynamic";

// Pre-fill the form from a library starter: its title + the copy-paste-ready
// composed build prompt (already archetype-shaped, with role/guardrails).
async function starterDefaults(starterId: string | undefined) {
  if (!starterId) return undefined;
  const agent = await getLibraryAgent(starterId);
  if (!agent) return undefined;
  return { name: agent.title, description: agent.prompt };
}

export default async function NewAgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ starter?: string }>;
}) {
  const [{ workspace: slug }, { starter: starterId }] = await Promise.all([
    params,
    searchParams,
  ]);

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    redirect(`/onboarding/repo?ws=${encodeURIComponent(workspace.slug)}`);
  }

  const defaults = await starterDefaults(starterId);

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
        <p className="text-foreground-weak text-sm">
          Not sure where to start?{" "}
          <Link
            href={`/${workspace.slug}/library`}
            className="text-foreground font-medium hover:underline"
          >
            Browse the agent library →
          </Link>
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <NewAgentForm
        workspaceSlug={workspace.slug}
        commitMode={workspace.commitMode}
        defaults={defaults}
      />
    </div>
  );
}
