import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { DeleteAgentButton } from "./delete-agent-button";
import { RunNowButton } from "./run-now-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FRAMEWORK_LABELS } from "@/lib/agent-framework";
import { getInstanceName } from "@/lib/config";
import { listRecentRunsForAgent, type RunSummary } from "@/lib/runs-db";
import { getServerSession } from "@/lib/session";
import { getAgentByName } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  userIsMember,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string }>;
}) {
  const { workspace: slug, agent: agentName } = await params;

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

  const result = await getAgentByName(workspace.id, agentName);
  if (!result) notFound();
  const { agent, raw } = result;
  const canonicalName = agent.ok ? agent.spec.name : agentName;

  const [recentRuns] = await Promise.all([
    listRecentRunsForAgent(workspace.id, canonicalName, 10),
  ]);

  const sourceHref = `https://github.com/${repo.owner}/${repo.name}/blob/${repo.defaultBranch}/${agent.path}`;
  const instanceName = getInstanceName();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-8 py-16">
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-3">
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
              {agent.ok ? agent.spec.name : agentName}
            </h1>
          </div>
          {agent.ok ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="blue" size="default">
                {FRAMEWORK_LABELS[agent.spec.framework]}
              </Badge>
              <Badge variant="purple" size="default">
                {agent.spec.model}
              </Badge>
              <span className="text-foreground-muted text-xs">
                <code>{agent.filename}</code>
              </span>
            </div>
          ) : (
            <p className="text-sentiment-negative text-sm">
              Invalid agent: {agent.error}
              {agent.detail ? ` — ${agent.detail}` : ""}
            </p>
          )}
          {agent.ok && agent.spec.description && (
            <p className="text-foreground-weak max-w-prose text-sm leading-6">
              {agent.spec.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {agent.ok && (
            <RunNowButton
              workspaceSlug={workspace.slug}
              agentName={canonicalName}
            />
          )}
          <Button asChild variant="ghost" size="small">
            <a href={sourceHref} target="_blank" rel="noreferrer noopener">
              View source
            </a>
          </Button>
          <DeleteAgentButton
            workspaceSlug={workspace.slug}
            agentName={canonicalName}
          />
          <SignOutButton />
        </div>
      </header>

      <Card className="p-3">
        <CardHeader className="px-1 pb-3 pt-1">
          <CardTitle className="text-foreground-title text-base">
            Recent runs
          </CardTitle>
        </CardHeader>
        <CardContent className="px-1 pb-1">
          <RecentRuns
            runs={recentRuns}
            workspaceSlug={workspace.slug}
            agentName={canonicalName}
          />
        </CardContent>
      </Card>

      <Card className="p-3">
        <CardHeader className="px-1 pb-3 pt-1">
          <CardTitle className="text-foreground-title text-base">
            Definition
          </CardTitle>
        </CardHeader>
        <CardContent className="px-1 pb-1">
          <pre className="bg-surface border-border text-foreground overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-5">
            {raw}
          </pre>
          <p className="text-foreground-muted mt-2 text-xs">
            Edits go through Git. v0.2 adds chat-to-PR; for now, edit the file
            in your repo and commit. Framework and{" "}
            <code className="bg-surface rounded px-1 py-0.5">model</code>{" "}
            changes go through the same review path as any other change —
            never edited in a live console.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function RecentRuns({
  runs,
  workspaceSlug,
  agentName,
}: {
  runs: RunSummary[];
  workspaceSlug: string;
  agentName: string;
}) {
  if (runs.length === 0) {
    return (
      <p className="text-foreground-weak text-sm">
        No runs yet. Click <strong className="text-foreground">Run now</strong>{" "}
        in the header to kick one off.
      </p>
    );
  }
  return (
    <ul className="divide-border flex flex-col divide-y">
      {runs.map((run) => {
        const tone = STATUS_TONE[run.status];
        return (
          <li key={run.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <Link
              href={`/${workspaceSlug}/agents/${encodeURIComponent(agentName)}/runs/${run.id}`}
              className="flex flex-1 items-center gap-3"
            >
              <Badge variant={tone.variant} size="small">
                {STATUS_LABELS[run.status]}
              </Badge>
              <span className="text-foreground-muted text-xs">
                {formatDate(run.createdAt)}
              </span>
            </Link>
            <Link
              href={`/${workspaceSlug}/agents/${encodeURIComponent(agentName)}/runs/${run.id}`}
              className="text-foreground-weak hover:text-foreground text-xs"
            >
              Open →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const STATUS_LABELS: Record<RunSummary["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

const STATUS_TONE: Record<
  RunSummary["status"],
  { variant: "blue" | "yellow" | "green" | "red" }
> = {
  queued: { variant: "yellow" },
  running: { variant: "blue" },
  succeeded: { variant: "green" },
  failed: { variant: "red" },
};

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
