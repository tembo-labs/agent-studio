import Link from "next/link";
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

import { CopyOutputButton } from "./copy-output-button";
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
              Trigger
            </dt>
            <dd className="text-foreground">
              {run.trigger === "schedule" && run.automationId ? (
                <>
                  Scheduled —{" "}
                  <Link
                    href={`/${workspace.slug}/automations/${run.automationId}`}
                    className="hover:underline"
                  >
                    view automation
                  </Link>
                </>
              ) : run.trigger === "schedule" ? (
                "Scheduled (automation deleted)"
              ) : run.trigger === "event" ? (
                "Event (Composio webhook)"
              ) : (
                "Manual"
              )}
            </dd>
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
          <div className="bg-surface-raised border-border group relative overflow-hidden rounded-lg border">
            <div className="absolute right-2 top-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
              <CopyOutputButton text={stripStopReason(run.output)} />
            </div>
            <pre className="text-foreground overflow-x-auto whitespace-pre-wrap p-4 text-sm leading-6">
              {stripStopReason(run.output)}
            </pre>
          </div>
        )}
        {run.status === "failed" && run.errorMessage && (
          <FailedReason
            run={run}
            workspaceSlug={workspace.slug}
          />
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

function FailedReason({
  run,
  workspaceSlug,
}: {
  run: RunRecord;
  workspaceSlug: string;
}) {
  // First slice of the error message used as the "similar failures"
  // search term. Matches the prefix the per-agent dashboard uses for
  // its failure groups (120 chars), so the same root cause across
  // runs lands in the same bucket. Truncate to ~80 chars for the URL
  // — anything longer just shows up as a less specific match anyway.
  const errorSearchTerm =
    run.errorMessage?.slice(0, 80).trim() ?? "";
  const similarHref = `/${workspaceSlug}/runs?${new URLSearchParams({
    status: "failed",
    agent: run.agentName,
    q: errorSearchTerm,
  }).toString()}`;
  const failureGroupsHref = `/${workspaceSlug}/agents/${encodeURIComponent(run.agentName)}#failures`;

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[var(--color-sentiment-negative)] bg-[var(--color-input-error)] p-3 text-sm">
      <span className="text-sentiment-negative font-medium">
        Failure reason
      </span>
      <span className="text-foreground whitespace-pre-wrap font-mono text-xs leading-5">
        {run.errorMessage}
      </span>
      {/* Two investigation jumps. "Similar runs" pulls every failed
          run on this agent with the same error prefix in /runs;
          "Failure groups" jumps to the per-agent dashboard's
          grouped-by-error rollup. Same data, two pivots. */}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
        {errorSearchTerm && (
          <Link
            href={similarHref}
            className="text-foreground hover:underline"
          >
            Find similar runs →
          </Link>
        )}
        <Link
          href={failureGroupsHref}
          className="text-foreground-weak hover:text-foreground hover:underline"
        >
          View {run.agentName} failure groups →
        </Link>
      </div>
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
