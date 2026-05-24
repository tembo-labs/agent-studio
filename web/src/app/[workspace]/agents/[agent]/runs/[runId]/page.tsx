import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { estimateRunCost, formatCurrency, formatTokens } from "@/lib/pricing";
import { getRun, type RunRecord } from "@/lib/runs-api";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { RunPoller } from "./run-poller";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string; runId: string }>;
}) {
  const { workspace: slug, runId } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const run = await getRun(runId);
  if (!run) notFound();
  // Defense against URL guessing for other workspaces' runs.
  if (run.workspaceId !== workspace.id) notFound();

  const tone = STATUS_TONE[run.status];
  const agentHref = `/${workspace.slug}/agents/${encodeURIComponent(run.agentName)}`;
  const totalTokens =
    run.tokensInput !== null && run.tokensOutput !== null
      ? run.tokensInput + run.tokensOutput
      : null;
  const estimatedCost =
    run.tokensInput !== null && run.tokensOutput !== null
      ? estimateRunCost(run.model, run.tokensInput, run.tokensOutput)
      : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <RunPoller status={run.status} />
      <div className="flex flex-col gap-3">
        <BackLink href={agentHref} label={run.agentName} />
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Run
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={tone.variant} size="small">
            {STATUS_LABELS[run.status]}
          </Badge>
          <Badge variant="purple" size="small">
            {run.model}
          </Badge>
        </div>
        <dl className="flex flex-col gap-0.5 text-xs">
          <div className="flex gap-2">
            <dt className="text-foreground-weak w-20 shrink-0">Queued</dt>
            <dd className="text-foreground-muted">
              <LocalTime iso={run.createdAt} />
            </dd>
          </div>
          {run.startedAt && (
            <div className="flex gap-2">
              <dt className="text-foreground-weak w-20 shrink-0">Started</dt>
              <dd className="text-foreground-muted">
                {formatRelative(run.createdAt, run.startedAt)}
              </dd>
            </div>
          )}
          {run.completedAt && run.startedAt && (
            <div className="flex gap-2">
              <dt className="text-foreground-weak w-20 shrink-0">Ran for</dt>
              <dd className="text-foreground-muted">
                {formatDuration(run.startedAt, run.completedAt)}
              </dd>
            </div>
          )}
          {totalTokens !== null && (
            <div className="flex gap-2">
              <dt className="text-foreground-weak w-20 shrink-0">Consumed</dt>
              <dd className="text-foreground-muted">
                {formatTokens(totalTokens)} tokens
                {estimatedCost !== null && (
                  <span> (~{formatCurrency(estimatedCost)})</span>
                )}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <Section title="Output">
        {run.status === "queued" && !run.output && (
          <p className="text-foreground-weak text-sm">Waiting to start…</p>
        )}
        {run.status === "running" && !run.output && (
          <p className="text-foreground-weak text-sm">Running…</p>
        )}
        {run.output && (
          <pre className="bg-surface border-border text-foreground overflow-x-auto whitespace-pre-wrap rounded-lg border p-4 font-mono text-xs leading-5">
            {run.output}
          </pre>
        )}
        {run.status === "failed" && run.errorMessage && (
          <FailedReason run={run} />
        )}
      </Section>
    </div>
  );
}

function FailedReason({ run }: { run: RunRecord }) {
  return (
    <div className="mt-3 flex flex-col gap-1 rounded-lg border border-[var(--color-sentiment-negative)] bg-[var(--color-input-error)] p-3 text-sm">
      <span className="text-sentiment-negative font-medium">
        Failure reason
      </span>
      <span className="text-foreground whitespace-pre-wrap font-mono text-xs leading-5">
        {run.errorMessage}
      </span>
    </div>
  );
}

const STATUS_LABELS: Record<RunRecord["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

const STATUS_TONE: Record<
  RunRecord["status"],
  { variant: "blue" | "yellow" | "green" | "red" }
> = {
  queued: { variant: "yellow" },
  running: { variant: "blue" },
  succeeded: { variant: "green" },
  failed: { variant: "red" },
};

function formatRelative(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (ms < 1000) return `${ms}ms after queued`;
  return `${Math.round(ms / 1000)}s after queued`;
}

function formatDuration(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
