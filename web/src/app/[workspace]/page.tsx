import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Section } from "@/components/section";
import { TopBar } from "@/components/top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FRAMEWORK_LABELS } from "@/lib/agent-framework";
import { getServerSession } from "@/lib/session";
import { listAgents, type ListedAgent } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  // Auth + membership already gated by the layout. We still need workspace
  // + repo for content-level work.
  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    redirect(`/onboarding/repo?ws=${encodeURIComponent(workspace.slug)}`);
  }

  const [apiKeyPreview, agentsResult] = await Promise.all([
    getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
    listAgents(workspace.id),
  ]);

  return (
    <>
      <TopBar
        title="Agents"
        meta={
          <>
            <a
              href={`https://github.com/${repo.owner}/${repo.name}`}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:underline"
            >
              github.com/{repo.owner}/{repo.name}
            </a>
            <span className="text-foreground-muted"> · </span>
            <span>default branch {repo.defaultBranch}</span>
          </>
        }
        actions={
          <Button asChild variant="primary" size="small">
            <Link href={`/${workspace.slug}/agents/new`}>New agent</Link>
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-6">
        {!apiKeyPreview && (
          <div className="bg-surface-raised border-border flex flex-col gap-2 rounded-lg border p-4">
            <h2 className="text-foreground text-sm font-medium">
              Add your Tembo API key
            </h2>
            <p className="text-foreground-weak text-sm">
              TAS needs a Tembo API key to invoke Tembo services on this
              workspace&apos;s behalf. Until it&apos;s set, agents can&apos;t run.
            </p>
            <div>
              <Link
                href={`/${workspace.slug}/settings`}
                className="text-foreground hover:underline text-sm font-medium"
              >
                Add it in Settings →
              </Link>
            </div>
          </div>
        )}

        <Section
          title="All agents"
          description="Agent definitions committed to the connected repo."
        >
          <AgentList
            workspaceSlug={workspace.slug}
            repoOwner={repo.owner}
            repoName={repo.name}
            defaultBranch={repo.defaultBranch}
            result={agentsResult}
          />
        </Section>
      </div>
    </>
  );
}

function AgentList({
  workspaceSlug,
  repoOwner,
  repoName,
  defaultBranch,
  result,
}: {
  workspaceSlug: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  result: Awaited<ReturnType<typeof listAgents>>;
}) {
  if (!result.ok) {
    return (
      <div className="text-sentiment-negative text-sm">
        Couldn&apos;t list agents: {result.error}
        {result.detail ? ` — ${result.detail}` : ""}
      </div>
    );
  }

  if (result.agents.length === 0) {
    return (
      <div className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm">
        No agents yet.{" "}
        <Link
          href={`/${workspaceSlug}/agents/new`}
          className="text-foreground hover:underline font-medium"
        >
          Create one →
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-border flex flex-col divide-y border-y border-[var(--color-border)]">
      {result.agents.map((agent) => (
        <li key={agent.path} className="py-2.5">
          <AgentRow
            agent={agent}
            workspaceSlug={workspaceSlug}
            repoOwner={repoOwner}
            repoName={repoName}
            defaultBranch={defaultBranch}
          />
        </li>
      ))}
    </ul>
  );
}

function AgentRow({
  agent,
  workspaceSlug,
  repoOwner,
  repoName,
  defaultBranch,
}: {
  agent: ListedAgent;
  workspaceSlug: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
}) {
  const sourceHref = `https://github.com/${repoOwner}/${repoName}/blob/${defaultBranch}/${agent.path}`;
  if (agent.ok) {
    const detailHref = `/${workspaceSlug}/agents/${encodeURIComponent(agent.spec.name)}`;
    return (
      <div className="flex items-center justify-between gap-3">
        <Link href={detailHref} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-foreground text-sm font-medium hover:underline">
            {agent.spec.name}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="blue" size="small">
              {FRAMEWORK_LABELS[agent.spec.framework]}
            </Badge>
            <Badge variant="purple" size="small">
              {agent.spec.model ?? "—"}
            </Badge>
            <span className="text-foreground-muted text-xs">
              <code>{agent.filename}</code>
            </span>
          </div>
        </Link>
        <a
          href={sourceHref}
          target="_blank"
          rel="noreferrer noopener"
          className="text-foreground-weak hover:text-foreground text-xs"
        >
          View source
        </a>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-foreground text-sm font-medium">
          {agent.filename}
        </span>
        <a
          href={sourceHref}
          target="_blank"
          rel="noreferrer noopener"
          className="text-foreground-weak hover:text-foreground text-xs"
        >
          View source
        </a>
      </div>
      <p className="text-sentiment-negative text-xs">
        Invalid agent: {agent.error}
        {agent.detail ? ` — ${agent.detail}` : ""}
      </p>
    </div>
  );
}
