import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <RunPoller status={run.status} />
      <div className="flex flex-col gap-2">
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
          <span className="text-foreground-muted text-xs">
            Queued <LocalTime iso={run.createdAt} />
            {run.startedAt && (
              <> · started {formatRelative(run.createdAt, run.startedAt)}</>
            )}
            {run.completedAt && run.startedAt && (
              <>
                {" · ran "}
                {formatDuration(run.startedAt, run.completedAt)}
              </>
            )}
          </span>
        </div>
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
  // Surface the failure reason prominently — US-0.1-06 explicitly asks
  // for "clear failure reason, not a stack trace."
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
  if (ms < 1000) return `for ${ms}ms`;
  return `for ${(ms / 1000).toFixed(1)}s`;
}
