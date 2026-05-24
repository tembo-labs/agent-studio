import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FRAMEWORK_LABELS } from "@/lib/agent-framework";
import { listRecentRunsForAgent, type RunSummary } from "@/lib/runs-db";
import { getServerSession } from "@/lib/session";
import { getAgentByName } from "@/lib/workspace-agents";
import { getWorkspaceBySlug, getWorkspaceRepo } from "@/lib/workspace";

import { DeleteAgentButton } from "./delete-agent-button";
import { RunNowButton } from "./run-now-button";

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

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    redirect(`/onboarding/repo?ws=${encodeURIComponent(workspace.slug)}`);
  }

  const result = await getAgentByName(workspace.id, agentName);
  if (!result) notFound();
  const { agent, raw } = result;
  const canonicalName = agent.ok ? agent.spec.name : agentName;

  const recentRuns = await listRecentRunsForAgent(
    workspace.id,
    canonicalName,
    10,
  );

  const sourceHref = `https://github.com/${repo.owner}/${repo.name}/blob/${repo.defaultBranch}/${agent.path}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <BackLink href={`/${workspace.slug}`} label="Agents" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
              {canonicalName}
            </h1>
            {agent.ok ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="blue" size="small">
                  {FRAMEWORK_LABELS[agent.spec.framework]}
                </Badge>
                <Badge variant="purple" size="small">
                  {agent.spec.model ?? "—"}
                </Badge>
                <code className="text-foreground-muted text-[11px]">
                  {agent.filename}
                </code>
              </div>
            ) : (
              <p className="text-sentiment-negative text-sm">
                Invalid agent: {agent.error}
                {agent.detail ? ` — ${agent.detail}` : ""}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost">
              <a href={sourceHref} target="_blank" rel="noreferrer noopener">
                View source
              </a>
            </Button>
            <DeleteAgentButton
              workspaceSlug={workspace.slug}
              agentName={canonicalName}
            />
          </div>
        </div>
        {agent.ok && agent.spec.description && (
          <p className="text-foreground-weak max-w-prose text-sm leading-6">
            {agent.spec.description}
          </p>
        )}
      </div>

      {agent.ok && (
        <RunNowButton
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
        />
      )}

      <hr className="border-[var(--color-border-weak)]" />

      <div className="flex flex-col gap-8">
        <Section
          title="Recent runs"
          description={
            recentRuns.length === 0
              ? undefined
              : `Last ${recentRuns.length} run${recentRuns.length === 1 ? "" : "s"}.`
          }
        >
          <RecentRuns
            runs={recentRuns}
            workspaceSlug={workspace.slug}
            agentName={canonicalName}
          />
        </Section>

        <Section
          title="Definition"
          description="Edits go through Git. Framework and model changes go through the same review path as any other change — never edited in a live console."
        >
          <pre className="bg-surface border-border text-foreground overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-5">
            {raw}
          </pre>
        </Section>
      </div>
    </div>
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
      <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
        No runs yet. Click <strong className="text-foreground">Run now</strong>{" "}
        above.
      </p>
    );
  }
  return (
    <ul className="divide-border flex flex-col divide-y border-y border-[var(--color-border)]">
      {runs.map((run) => {
        const tone = STATUS_TONE[run.status];
        return (
          <li
            key={run.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <Link
              href={`/${workspaceSlug}/agents/${encodeURIComponent(agentName)}/runs/${run.id}`}
              className="flex flex-1 items-center gap-3"
            >
              <Badge variant={tone.variant} size="small">
                {STATUS_LABELS[run.status]}
              </Badge>
              <LocalTime
                iso={run.createdAt.toISOString()}
                className="text-foreground-muted text-xs"
              />
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
