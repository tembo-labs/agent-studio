import Link from "next/link";
import { notFound } from "next/navigation";

import { LocalTime } from "@/components/local-time";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInstanceName } from "@/lib/config";
import { getRun, type RunRecord } from "@/lib/runs-api";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

import { RunPoller } from "./run-poller";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string; runId: string }>;
}) {
  const { workspace: slug, agent: agentName, runId } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  const run = await getRun(runId);
  if (!run) notFound();
  // Defense against URL guessing for other workspaces' runs.
  if (run.workspaceId !== workspace.id) notFound();

  const instanceName = getInstanceName();
  const tone = STATUS_TONE[run.status];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-8 py-16">
      <RunPoller status={run.status} />
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-3">
          <p className="text-foreground-weak text-xs font-medium uppercase tracking-widest">
            {instanceName}
          </p>
          <div className="flex flex-wrap items-baseline gap-3">
            <Link
              href={`/${workspace.slug}`}
              className="text-foreground-weak hover:text-foreground text-sm"
            >
              {workspace.name}
            </Link>
            <span className="text-foreground-muted text-sm">/</span>
            <Link
              href={`/${workspace.slug}/agents/${encodeURIComponent(run.agentName)}`}
              className="text-foreground-weak hover:text-foreground text-sm"
            >
              {run.agentName}
            </Link>
            <span className="text-foreground-muted text-sm">/</span>
            <h1 className="text-foreground-title text-2xl font-semibold tracking-tight">
              Run
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={tone.variant} size="default">
              {STATUS_LABELS[run.status]}
            </Badge>
            <Badge variant="purple" size="default">
              {run.model}
            </Badge>
            <span className="text-foreground-muted text-xs">
              Queued <LocalTime iso={run.createdAt} />
              {run.startedAt && (
                <> · started {formatRelative(run.createdAt, run.startedAt)}</>
              )}
              {run.completedAt && run.startedAt && (
                <>
                  {" · "}
                  ran {formatDuration(run.startedAt, run.completedAt)}
                </>
              )}
            </span>
          </div>
        </div>
        <SignOutButton />
      </header>

      <Card className="p-3">
        <CardHeader className="flex-col items-start gap-1 px-1 pb-3 pt-1">
          <CardTitle className="text-foreground-title text-base">
            Output
          </CardTitle>
        </CardHeader>
        <CardContent className="px-1 pb-1">
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
        </CardContent>
      </Card>

      <div>
        <Button asChild variant="ghost" size="small">
          <Link href={`/${workspace.slug}/agents/${encodeURIComponent(run.agentName)}`}>
            ← Back to agent
          </Link>
        </Button>
      </div>
    </main>
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
