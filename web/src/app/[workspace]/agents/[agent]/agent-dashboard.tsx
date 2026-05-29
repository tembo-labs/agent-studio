import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { formatCurrency } from "@/lib/pricing";
import {
  type AgentDailyRunBands,
  type AgentFailureGroup,
  type AgentStats30d,
} from "@/lib/runs-db";

import { DailyTrend } from "../../dashboard/workspace-dashboard";

// Per-agent operational dashboard. The four header tiles answer
// "how's it going lately?" at a glance; the daily trend bar makes
// the answer rhythm-visible; the failure groups answer "if it's not
// going well, what's broken?" by collapsing repeat errors into one
// row each so the noise doesn't drown the signal.
//
// All data is 30-day windowed — long-term success masks new
// failures, and short-term (24h) is too noisy for low-volume
// agents. 30 days is a reasonable middle for "recent behavior."

type Props = {
  stats: AgentStats30d;
  daily: AgentDailyRunBands[];
  failures: AgentFailureGroup[];
  workspaceSlug: string;
  agentName: string;
};

export function AgentDashboard({
  stats,
  daily,
  failures,
  workspaceSlug,
  agentName,
}: Props) {
  // Empty state when an agent has no run history at all in 30d —
  // tiles would all show "0" which is technically true but reads
  // as broken. Skip the dashboard, let the rest of the page lead.
  if (stats.totalRuns === 0) {
    return null;
  }

  const successRate =
    stats.totalRuns > 0 ? stats.succeeded / stats.totalRuns : 0;

  return (
    <div className="flex flex-col gap-5">
      <StatTiles stats={stats} successRate={successRate} />
      <DailyTrend daily={daily} />
      {failures.length > 0 && (
        <FailureGroups
          failures={failures}
          workspaceSlug={workspaceSlug}
          agentName={agentName}
        />
      )}
    </div>
  );
}

function StatTiles({
  stats,
  successRate,
}: {
  stats: AgentStats30d;
  successRate: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile
        label="Runs (30d)"
        value={stats.totalRuns.toLocaleString("en-US")}
        sub={`${stats.succeeded} ok · ${stats.failed} failed`}
      />
      <Tile
        label="Success rate"
        value={`${Math.round(successRate * 100)}%`}
        sub={stats.totalRuns === 0 ? "no runs yet" : "last 30 days"}
      />
      <Tile
        label="Spend (30d)"
        value={
          stats.totalCostUsd > 0
            ? formatCurrency(stats.totalCostUsd)
            : "—"
        }
        sub={stats.totalCostUsd > 0 ? "approx" : "no cost data"}
      />
      <Tile
        label="Avg duration"
        value={
          stats.avgDurationMs !== null
            ? formatDuration(stats.avgDurationMs)
            : "—"
        }
        sub={
          stats.avgDurationMs !== null ? "completed runs" : "no completed runs"
        }
      />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-surface border-border flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <span className="text-foreground-weak text-sm font-medium uppercase tracking-widest">
        {label}
      </span>
      <span className="text-foreground-title text-xl font-semibold">
        {value}
      </span>
      <span className="text-foreground-muted text-sm">{sub}</span>
    </div>
  );
}

function FailureGroups({
  failures,
  workspaceSlug,
  agentName,
}: {
  failures: AgentFailureGroup[];
  workspaceSlug: string;
  agentName: string;
}) {
  return (
    // id="failures" + scroll-mt so deep links from the failed-run
    // detail page land here without their target headline hidden
    // under whatever's sticky above.
    <div id="failures" className="flex scroll-mt-4 flex-col gap-1.5">
      <span className="text-foreground-weak text-sm font-medium uppercase tracking-widest">
        Recent failures (30d)
      </span>
      <ul className="divide-border bg-surface border-border flex flex-col divide-y overflow-hidden rounded-lg border">
        {failures.map((f) => (
          <li key={f.exampleRunId} className="flex flex-col gap-1 px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-foreground truncate text-sm font-medium">
                ×{f.occurrences}
              </span>
              <Link
                href={`/${workspaceSlug}/agents/${encodeURIComponent(agentName)}/runs/${f.exampleRunId}`}
                className="text-foreground-weak hover:text-foreground shrink-0 text-xs hover:underline"
              >
                Last <LocalTime iso={f.lastSeen.toISOString()} style="relative" /> →
              </Link>
            </div>
            <pre className="text-foreground-weak overflow-hidden whitespace-pre-wrap break-words font-mono text-xs leading-5">
              {f.errorPrefix}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms - m * 60_000) / 1000);
  return `${m}m ${s}s`;
}
