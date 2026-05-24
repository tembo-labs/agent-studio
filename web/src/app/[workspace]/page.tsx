import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { getInstanceName } from "@/lib/config";
import { getServerSession } from "@/lib/session";
import { listAgents, type ListedAgent } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  getWorkspaceSecretPreview,
  userIsMember,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
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

  const [apiKeyPreview, agentsResult] = await Promise.all([
    getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
    listAgents(workspace.id),
  ]);
  const instanceName = getInstanceName();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-12 px-8 py-16">
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-foreground-weak text-xs font-medium uppercase tracking-widest">
            {instanceName}
          </p>
          <h1 className="text-foreground-title text-3xl font-semibold tracking-tight">
            {workspace.name}
          </h1>
          <p className="text-foreground-weak text-sm">
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
          </p>
          <p className="text-foreground-weak text-sm">
            Signed in as{" "}
            <span className="text-foreground font-medium">
              {session.user.email}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="small">
            <Link href={`/${workspace.slug}/settings`}>Settings</Link>
          </Button>
          <SignOutButton />
        </div>
      </header>

      {!apiKeyPreview && (
        <section className="bg-surface-raised border-border flex flex-col gap-2 rounded-lg border p-4">
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
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-foreground-weak text-sm font-medium uppercase tracking-wider">
            Agents
          </h2>
          <Button asChild variant="primary" size="small">
            <Link href={`/${workspace.slug}/agents/new`}>New agent</Link>
          </Button>
        </div>
        <AgentList
          workspaceSlug={workspace.slug}
          repoOwner={repo.owner}
          repoName={repo.name}
          defaultBranch={repo.defaultBranch}
          result={agentsResult}
        />
      </section>
    </main>
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
      <div className="bg-surface-raised border-border text-sentiment-negative rounded-lg border p-4 text-sm">
        Couldn&apos;t list agents: {result.error}
        {result.detail ? ` — ${result.detail}` : ""}
      </div>
    );
  }

  if (result.agents.length === 0) {
    return (
      <div className="bg-surface-raised border-border text-foreground-weak rounded-lg border p-8 text-center text-sm">
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
    <ul className="bg-surface-raised border-border flex flex-col divide-y divide-[var(--color-border)] overflow-hidden rounded-lg border">
      {result.agents.map((agent) => (
        <li key={agent.path} className="px-4 py-3">
          <AgentRow
            agent={agent}
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
  repoOwner,
  repoName,
  defaultBranch,
}: {
  agent: ListedAgent;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
}) {
  const sourceHref = `https://github.com/${repoOwner}/${repoName}/blob/${defaultBranch}/${agent.path}`;
  if (agent.ok) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-foreground text-sm font-medium">
            {agent.spec.name}
          </span>
          <span className="text-foreground-muted text-xs">
            <code>{agent.spec.model}</code>
            <span className="text-foreground-muted"> · </span>
            <code>{agent.filename}</code>
          </span>
        </div>
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
