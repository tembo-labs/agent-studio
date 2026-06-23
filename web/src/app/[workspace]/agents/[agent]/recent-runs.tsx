import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { type RunSummary } from "@/lib/runs-db";

// A compact list of an agent's recent runs. Used on the Overview tab (a short
// peek) and the Runs tab (the fuller list). Each row links to the run detail.

const STATUS_LABELS: Record<RunSummary["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<
  RunSummary["status"],
  { variant: "blue" | "yellow" | "green" | "red" | "gray" }
> = {
  queued: { variant: "yellow" },
  running: { variant: "blue" },
  succeeded: { variant: "green" },
  failed: { variant: "red" },
  cancelled: { variant: "gray" },
};

export function RecentRuns({
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
              {run.trigger === "schedule" && (
                <Badge variant="blue" size="small">
                  Scheduled
                </Badge>
              )}
              {run.trigger === "event" && (
                <Badge variant="purple" size="small">
                  Event
                </Badge>
              )}
              <LocalTime
                iso={run.createdAt.toISOString()}
                className="text-foreground-muted text-sm"
              />
            </Link>
            <Link
              href={`/${workspaceSlug}/agents/${encodeURIComponent(agentName)}/runs/${run.id}`}
              className="text-foreground-weak hover:text-foreground text-sm"
            >
              Open →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
