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
  getWorkspaceDailyRunBands30d,
  getWorkspaceStats30d,
  listRunsForWorkspace,
  listWorkspaceTopFailingAgents30d,
  type RunListItem,
} from "@/lib/runs-db";
import { listMemberActivity } from "@/lib/member-stats";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, getWorkspaceRole } from "@/lib/workspace";

import { CountCell } from "./count-cell";
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

  // Server component: compute the rolling window from the request-time clock.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - WEEK_MS);
  // Refresh open PR statuses before reading counts so the headline
  // numbers reflect reality. listOpenImprovements returns every non-
  // terminal row regardless of age.
  const open = await listOpenImprovements(workspace.id);
  await scanImprovementsForPRs(workspace.id, open);

  const [
    stats,
    daily,
    topFailing,
    improvementCounts,
    recentImprovements,
    recentRuns,
    memberActivity,
    role,
  ] = await Promise.all([
    getWorkspaceStats30d(workspace.id),
    getWorkspaceDailyRunBands30d(workspace.id),
    listWorkspaceTopFailingAgents30d(workspace.id, 5),
    countImprovementsSince(workspace.id, since),
    listImprovements(workspace.id, 10),
    listRunsForWorkspace(workspace.id, {}, { limit: 8 }),
    listMemberActivity(workspace.id),
    getWorkspaceRole(workspace.id, session.user.id),
  ]);
  const isAdmin = role === "workspace_admin";

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
        title="Team"
        description="Connections, automations, and 30-day run activity per member. Hover a count for details."
      >
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-foreground-weak text-sm uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Member</th>
                <th className="px-3 py-2 text-right font-medium">Connections</th>
                <th className="px-3 py-2 text-right font-medium">Automations</th>
                <th className="px-3 py-2 text-right font-medium">30d runs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-weak)]">
              {memberActivity.map((m) => (
                <tr
                  key={m.userId}
                  className="hover:bg-surface-secondary transition-colors"
                >
                  <td className="px-3 py-2 align-middle">
                    {isAdmin ? (
                      <Link
                        href={`/${workspace.slug}/settings/members/${m.userId}`}
                        className="text-foreground font-medium hover:underline"
                      >
                        {m.name ?? m.email}
                      </Link>
                    ) : (
                      <span className="text-foreground font-medium">
                        {m.name ?? m.email}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right align-middle">
                    <CountCell
                      value={m.connections}
                      items={m.connectionLabels}
                      empty="No connections"
                    />
                  </td>
                  <td className="px-3 py-2 text-right align-middle">
                    <CountCell
                      value={m.automations}
                      items={m.automationAgents}
                      empty="No automations"
                    />
                  </td>
                  <td className="text-foreground px-3 py-2 text-right align-middle font-mono">
                    {m.runs30d.toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Recent runs"
        description="The latest agent runs across this workspace."
        actions={
          <Link
            href={`/${workspace.slug}/runs`}
            className="text-foreground-weak hover:text-foreground text-sm"
          >
            View all →
          </Link>
        }
      >
        {recentRuns.length === 0 ? (
          <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
            No runs yet. Trigger a run from an agent to see it here.
          </p>
        ) : (
          <ul className="border-border divide-border-weak bg-surface divide-y overflow-hidden rounded-lg border">
            {recentRuns.map((r) => {
              const agentHref = `/${workspace.slug}/agents/${encodeURIComponent(r.agentName)}`;
              const runHref = `${agentHref}/runs/${r.id}`;
              // Failed runs preview the error; everything else previews
              // the input (empty for manual "Run now" with no message).
              const preview =
                r.status === "failed" && r.errorMessagePreview
                  ? r.errorMessagePreview
                  : r.userMessagePreview;
              return (
                <li
                  key={r.id}
                  className="hover:bg-surface-secondary relative flex items-start justify-between gap-4 px-3 py-2.5 text-sm transition-colors"
                >
                  {/* Stretched link: the whole row navigates to the run.
                      It sits behind the nested agent link (z-10), so that
                      sublink keeps working — no invalid nested anchors. */}
                  <Link
                    href={runHref}
                    aria-label={`Open run for ${r.agentName}`}
                    className="absolute inset-0"
                  />
                  <div className="relative flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={agentHref}
                        className="text-foreground relative z-10 font-medium hover:underline"
                      >
                        {r.agentName}
                      </Link>
                      <RunStatusBadge status={r.status} />
                    </div>
                    {preview && (
                      <p className="text-foreground-weak line-clamp-2 text-sm leading-5">
                        {preview}
                      </p>
                    )}
                  </div>
                  <div className="text-foreground-weak relative flex shrink-0 flex-col items-end gap-1 text-sm">
                    <span>
                      <LocalTime iso={r.createdAt.toISOString()} style="relative" />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

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
                className="text-foreground-weak hover:text-foreground text-sm"
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
                        <p className="text-foreground-weak line-clamp-2 text-sm leading-5">
                          {i.improvementText}
                        </p>
                      </div>
                      <div className="text-foreground-weak flex shrink-0 flex-col items-end gap-1 text-sm">
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

type RunStatus = RunListItem["status"];

const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

const RUN_STATUS_BADGE: Record<
  RunStatus,
  "green" | "red" | "yellow" | "blue" | "gray"
> = {
  queued: "yellow",
  running: "blue",
  succeeded: "green",
  failed: "red",
};

function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <Badge variant={RUN_STATUS_BADGE[status]} size="small">
      {RUN_STATUS_LABELS[status]}
    </Badge>
  );
}

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
