import Link from "next/link";
import { notFound } from "next/navigation";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
} from "@/lib/workspace";

import { DisconnectRepoForm } from "../disconnect-repo-form";

export const dynamic = "force-dynamic";

// Repository: the workspace's GitHub connection. Agent-guidance refresh
// and improvements-delivery moved to the Tembo Coding Agent tab — both
// configure the coding agent, not the repo link itself.

export default async function RepositoryPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const repo = await getWorkspaceRepo(workspace.id);

  return (
    <div className="divide-y divide-[var(--color-border-weak)]">
      <div className="pb-6 first:pt-0">
        <Section
          title="GitHub repository"
          description="The repo where this workspace's agent definitions live. Disconnecting drops the stored token and returns the workspace to the onboarding repo step."
        >
          {repo ? (
            <div className="bg-surface border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="flex flex-col">
                <a
                  href={`https://github.com/${repo.owner}/${repo.name}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-foreground text-sm font-medium hover:underline"
                >
                  github.com/{repo.owner}/{repo.name}
                </a>
                <span className="text-foreground-muted text-sm">
                  Default branch {repo.defaultBranch} · connected{" "}
                  <LocalTime iso={repo.connectedAt.toISOString()} />
                </span>
              </div>
              <DisconnectRepoForm workspaceSlug={workspace.slug} />
            </div>
          ) : (
            <p className="text-foreground-weak text-base">
              No repository connected.{" "}
              <Link
                href={`/onboarding/repo?ws=${encodeURIComponent(workspace.slug)}`}
                className="text-foreground hover:underline"
              >
                Connect one now →
              </Link>
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
