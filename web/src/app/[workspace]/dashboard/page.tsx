import Link from "next/link";
import { notFound } from "next/navigation";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { scanImprovementsForPRs } from "@/lib/improvement-scan";
import {
  countImprovementsSince,
  listImprovements,
  listOpenImprovements,
  type ImprovementStatus,
} from "@/lib/improvements-api";
import {
  getWorkspaceDailyRuns30d,
  getWorkspaceStats30d,
  listWorkspaceTopFailingAgents30d,
} from "@/lib/runs-db";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { WorkspaceDashboard } from "./workspace-dashboard";

export const dynamic = "force-dynamic";

// Length of the "this week" window used for the Improvements counts.
// 7 days rolling avoids the cross-tz ambiguity of calendar weeks.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const since = new Date(Date.now() - WEEK_MS);
  // Refresh open PR statuses before reading counts so the headline
  // numbers reflect reality. listOpenImprovements returns every non-
  // terminal row regardless of age.
  const open = await listOpenImprovements(workspace.id);
  await scanImprovementsForPRs(workspace.id, open);

  const [stats, daily, topFailing, improvementCounts, recentImprovements] =
    await Promise.all([
      getWorkspaceStats30d(workspace.id),
      getWorkspaceDailyRuns30d(workspace.id),
      listWorkspaceTopFailingAgents30d(workspace.id, 5),
      countImprovementsSince(workspace.id, since),
      listImprovements(workspace.id, 10),
    ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-foreground-weak text-base">
          Workspace-wide activity for{" "}
          <span className="text-foreground font-medium">{workspace.name}</span>
          .
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <WorkspaceDashboard
        stats={stats}
        daily={daily}
        topFailing={topFailing}
        workspaceSlug={workspace.slug}
      />

      <Section
        title="Improvements"
        description="Edits proposed from run-detail pages this week, plus the latest activity."
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Submitted is the cumulative count of *all* improvement
                rows created in the window, regardless of their current
                status. The other three break that population down by
                where it ended up. */}
            <StatCard
              label="Submitted"
              value={improvementCounts.total}
              accent="gray"
            />
            <StatCard
              label="PR open"
              value={improvementCounts.pr_opened}
              accent="blue"
            />
            <StatCard
              label="Merged"
              value={improvementCounts.merged}
              accent="green"
            />
            <StatCard
              label="Closed"
              value={improvementCounts.closed}
              accent="red"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-foreground-weak text-sm font-medium uppercase tracking-widest">
                Recent improvements
              </span>
              <Link
                href={`/${workspace.slug}/improvements`}
                className="text-foreground-weak hover:text-foreground text-xs"
              >
                View all →
              </Link>
            </div>
            {recentImprovements.length === 0 ? (
              <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
                No improvements yet. Open a run and use{" "}
                <em>Improve the Agent</em> to start one.
              </p>
            ) : (
              <ul className="border-border divide-border-weak bg-surface divide-y overflow-hidden rounded-lg border">
                {recentImprovements.map((i) => {
                  const agentHref = `/${workspace.slug}/agents/${encodeURIComponent(i.agentName)}`;
                  const runHref = `${agentHref}/runs/${i.runId}`;
                  return (
                    <li
                      key={i.id}
                      className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={agentHref}
                            className="text-foreground font-medium hover:underline"
                          >
                            {i.agentName}
                          </Link>
                          <StatusBadge status={i.status} />
                        </div>
                        <p className="text-foreground-weak line-clamp-2 text-xs leading-5">
                          {i.improvementText}
                        </p>
                      </div>
                      <div className="text-foreground-weak flex shrink-0 flex-col items-end gap-1 text-xs">
                        <span>
                          <LocalTime iso={i.createdAt.toISOString()} />
                        </span>
                        <div className="flex gap-2">
                          <Link href={runHref} className="hover:underline">
                            Run
                          </Link>
                          {i.prUrl && (
                            <a
                              href={i.prUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="hover:underline"
                            >
                              PR ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "green" | "blue" | "gray" | "red";
}) {
  const accentClass = ACCENT_CLASS[accent];
  return (
    <div className="border-border bg-surface flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <span className="text-foreground-weak text-sm font-medium uppercase tracking-widest">
        {label}
      </span>
      <span className={`text-xl font-semibold ${accentClass}`}>{value}</span>
    </div>
  );
}

const ACCENT_CLASS: Record<"green" | "blue" | "gray" | "red", string> = {
  green: "text-sentiment-positive",
  blue: "text-[var(--color-blue-600)]",
  gray: "text-foreground",
  red: "text-sentiment-negative",
};

function StatusBadge({ status }: { status: ImprovementStatus }) {
  switch (status) {
    case "submitted":
      return (
        <Badge variant="gray" size="small">
          Submitted
        </Badge>
      );
    case "pr_opened":
      return (
        <Badge variant="blue" size="small">
          PR opened
        </Badge>
      );
    case "merged":
      return (
        <Badge variant="green" size="small">
          Merged
        </Badge>
      );
    case "closed":
      return (
        <Badge variant="red" size="small">
          Closed
        </Badge>
      );
  }
}
