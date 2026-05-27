import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { formatCurrency } from "@/lib/pricing";
import {
  type AgentDailyRunCount,
  type AgentStats30d,
  type WorkspaceTopFailingAgent,
} from "@/lib/runs-db";

// Workspace-level operational dashboard. Mirrors the per-agent
// dashboard's structure so an operator's reading flow is the same
// at both scales: health header → four tiles → 30-day trend → "what
// looks broken." The "what looks broken" cut at workspace scope is
// "which agents are failing" rather than "which error strings repeat"
// — same error message coming from two different agents is two
// different problems at the workspace level.

type Props = {
  stats: AgentStats30d;
  daily: AgentDailyRunCount[];
  topFailing: WorkspaceTopFailingAgent[];
  workspaceSlug: string;
};

export function WorkspaceDashboard({
  stats,
  daily,
  topFailing,
  workspaceSlug,
}: Props) {
  if (stats.totalRuns === 0) {
    return (
      <div className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
        No runs in the last 30 days yet — the dashboard fills in as
        agents start firing.
      </div>
    );
  }

  const successRate = stats.succeeded / stats.totalRuns;
  const failureRate = 1 - successRate;
  const healthBand =
    stats.failed === 0
      ? "healthy"
      : failureRate < 0.05
        ? "ok"
        : failureRate < 0.2
          ? "warn"
          : "alert";

  return (
    <div className="flex flex-col gap-5">
      <HealthHeader band={healthBand} stats={stats} />
      <StatTiles stats={stats} successRate={successRate} />
      <DailyTrend daily={daily} />
      {topFailing.length > 0 && (
        <TopFailingAgents
          rows={topFailing}
          workspaceSlug={workspaceSlug}
        />
      )}
    </div>
  );
}

function HealthHeader({
  band,
  stats,
}: {
  band: "healthy" | "ok" | "warn" | "alert";
  stats: AgentStats30d;
}) {
  const messages: Record<typeof band, string> = {
    healthy: `Healthy — ${stats.totalRuns} runs across the workspace in the last 30 days, no failures.`,
    ok: `Mostly healthy — ${stats.failed} of ${stats.totalRuns} runs failed in the last 30 days.`,
    warn: `Investigate — ${stats.failed} of ${stats.totalRuns} runs failed in the last 30 days.`,
    alert: `Broken — ${stats.failed} of ${stats.totalRuns} runs failed in the last 30 days.`,
  };
  const colors: Record<typeof band, string> = {
    healthy:
      "border-sentiment-positive bg-[var(--color-sentiment-positive-subtle)]",
    ok: "border-sentiment-positive bg-[var(--color-sentiment-positive-subtle)]",
    warn: "border-[var(--color-border-sentiment-caution)] bg-[var(--color-sentiment-caution-subtle)]",
    alert: "border-sentiment-negative bg-[var(--color-input-error)]",
  };
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${colors[band]}`}
      role={band === "alert" ? "alert" : undefined}
    >
      <span className="text-foreground">{messages[band]}</span>
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
        sub="last 30 days"
      />
      <Tile
        label="Spend (30d)"
        value={
          stats.totalCostUsd > 0 ? formatCurrency(stats.totalCostUsd) : "—"
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
      <span className="text-foreground-weak text-[10px] font-medium uppercase tracking-widest">
        {label}
      </span>
      <span className="text-foreground-title text-xl font-semibold">
        {value}
      </span>
      <span className="text-foreground-muted text-xs">{sub}</span>
    </div>
  );
}

function DailyTrend({ daily }: { daily: AgentDailyRunCount[] }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const days: AgentDailyRunCount[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(
      byDay.get(key) ?? { day: key, succeeded: 0, failed: 0, other: 0 },
    );
  }
  const maxRuns = Math.max(
    1,
    ...days.map((d) => d.succeeded + d.failed + d.other),
  );
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-foreground-weak text-[10px] font-medium uppercase tracking-widest">
          Last 30 days
        </span>
        <span className="text-foreground-muted text-xs">
          {days[0].day} → {days[days.length - 1].day}
        </span>
      </div>
      <div className="bg-surface border-border flex h-16 items-end gap-[2px] rounded-lg border p-2">
        {days.map((d) => {
          const total = d.succeeded + d.failed + d.other;
          const heightPct = total === 0 ? 0 : (total / maxRuns) * 100;
          const failedPct = total === 0 ? 0 : (d.failed / total) * 100;
          return (
            <div
              key={d.day}
              title={`${d.day}: ${d.succeeded} succeeded, ${d.failed} failed${d.other ? `, ${d.other} other` : ""}`}
              className="bg-surface-secondary relative flex-1 self-stretch rounded-sm"
            >
              <div
                className="absolute bottom-0 left-0 right-0 rounded-sm bg-[var(--color-sentiment-positive)] opacity-80"
                style={{ height: `${heightPct}%` }}
              />
              {failedPct > 0 && (
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-sm bg-[var(--color-sentiment-negative)]"
                  style={{ height: `${(heightPct * failedPct) / 100}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopFailingAgents({
  rows,
  workspaceSlug,
}: {
  rows: WorkspaceTopFailingAgent[];
  workspaceSlug: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-foreground-weak text-[10px] font-medium uppercase tracking-widest">
        Top failing agents (30d)
      </span>
      <ul className="divide-border bg-surface border-border flex flex-col divide-y overflow-hidden rounded-lg border">
        {rows.map((r) => {
          const rate = r.totalRuns > 0 ? r.failures / r.totalRuns : 0;
          return (
            <li
              key={r.agentName}
              className="flex flex-col gap-1 px-3 py-2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-2">
                  <Link
                    href={`/${workspaceSlug}/agents/${encodeURIComponent(r.agentName)}`}
                    className="text-foreground truncate text-sm font-medium hover:underline"
                  >
                    {r.agentName}
                  </Link>
                  <span className="text-foreground-weak text-xs">
                    ×{r.failures} failures / {r.totalRuns} runs · {Math.round(rate * 100)}%
                  </span>
                </div>
                <Link
                  href={`/${workspaceSlug}/agents/${encodeURIComponent(r.agentName)}/runs/${r.exampleRunId}`}
                  className="text-foreground-weak hover:text-foreground shrink-0 text-xs hover:underline"
                >
                  Last <LocalTime iso={r.lastSeen.toISOString()} /> →
                </Link>
              </div>
            </li>
          );
        })}
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
