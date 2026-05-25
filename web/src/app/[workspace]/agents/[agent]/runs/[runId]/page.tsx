import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { scanImprovementsForPRs } from "@/lib/improvement-scan";
import { listImprovementsForRun } from "@/lib/improvements-api";
import { estimateRunCost, formatCurrency, formatTokens } from "@/lib/pricing";
import { getRun, type RunRecord } from "@/lib/runs-api";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { ImproveForm } from "./improve-form";
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

  // Inline improvement history. Scan refreshes pr_state for the few
  // open rows tied to this run — cheap because it's at most a
  // handful of improvements per run, not the whole workspace.
  const storedImprovements = await listImprovementsForRun(run.id);
  const improvements = await scanImprovementsForPRs(
    workspace.id,
    storedImprovements,
  );

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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <RunPoller status={run.status} />
      <div className="flex flex-col gap-3">
        <BackLink href={agentHref} label={run.agentName} />
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Run
        </h1>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex gap-3">
            <dt className="text-foreground-weak w-24 shrink-0 font-medium">
              Status
            </dt>
            <dd className={`${STATUS_TEXT_TONE[run.status]} font-medium`}>
              {STATUS_LABELS[run.status]}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-foreground-weak w-24 shrink-0 font-medium">
              Model
            </dt>
            <dd className="text-foreground">{run.model}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-foreground-weak w-24 shrink-0 font-medium">
              Queued
            </dt>
            <dd className="text-foreground">
              <LocalTime iso={run.createdAt} />
            </dd>
          </div>
          {run.startedAt && (
            <div className="flex gap-3">
              <dt className="text-foreground-weak w-24 shrink-0 font-medium">
                Started
              </dt>
              <dd className="text-foreground">
                {formatRelative(run.createdAt, run.startedAt)}
              </dd>
            </div>
          )}
          {run.completedAt && run.startedAt && (
            <div className="flex gap-3">
              <dt className="text-foreground-weak w-24 shrink-0 font-medium">
                Ran for
              </dt>
              <dd className="text-foreground">
                {formatDuration(run.startedAt, run.completedAt)}
              </dd>
            </div>
          )}
          {totalTokens !== null && (
            <div className="flex gap-3">
              <dt className="text-foreground-weak w-24 shrink-0 font-medium">
                Consumed
              </dt>
              <dd className="text-foreground">
                {formatTokens(totalTokens)} tokens
                {estimatedCost !== null && (
                  <span className="text-foreground-weak">
                    {" "}
                    (~{formatCurrency(estimatedCost)})
                  </span>
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
          <pre className="bg-surface-raised border-border text-foreground overflow-x-auto whitespace-pre-wrap rounded-lg border p-4 text-sm leading-6">
            {stripStopReason(run.output)}
          </pre>
        )}
        {run.status === "failed" && run.errorMessage && (
          <FailedReason run={run} />
        )}
      </Section>

      {/* Hide the improvement section while the run is in flight — there's
          nothing to improve on yet, and the form pulling the eye away
          from the streaming output feels wrong. Fade it in two seconds
          after the output settles so the user finishes reading first. */}
      {(run.status === "succeeded" || run.status === "failed") && (
        <>
          <hr className="border-[var(--color-border-weak)]" />
          <ImproveForm
            workspaceSlug={workspace.slug}
            runId={run.id}
            improvements={improvements}
          />
        </>
      )}
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

// Colored text tone per status, used inline in the meta <dl>. Replaces
// the Badge pair we used to render above the metadata block — same
// semantics, less visual weight.
const STATUS_TEXT_TONE: Record<RunRecord["status"], string> = {
  queued: "text-[var(--color-yellow-700)]",
  running: "text-[var(--color-blue-600)]",
  succeeded: "text-sentiment-positive",
  failed: "text-sentiment-negative",
};

// Historical runs (pre-9d5f2dc) have a `\n\n[stop_reason=...]`
// suffix appended by the Rust runner. Strip it on read so older
// outputs render cleanly. Future runs don't write the suffix at all.
function stripStopReason(output: string): string {
  return output.replace(/\n*\[stop_reason=[^\]]*\]\s*$/, "");
}

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
