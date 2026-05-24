import Link from "next/link";
import { notFound } from "next/navigation";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { scanFeedbacksForPRs } from "@/lib/feedback-scan";
import {
  countFeedbacksSince,
  listFeedbacks,
  type FeedbackStatus,
} from "@/lib/feedbacks-api";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Length of the "this week" window we use for the headline stats.
// Calendar weeks would be neater but ambiguous across time zones —
// a rolling 7 days is what every analytics tool defaults to anyway.
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
  // numbers reflect reality. The scan is bounded to feedbacks that
  // haven't reached a terminal status, so it stays cheap.
  const stored = await listFeedbacks(workspace.id, 50);
  await scanFeedbacksForPRs(workspace.id, stored);

  const [counts, recent] = await Promise.all([
    countFeedbacksSince(workspace.id, since),
    listFeedbacks(workspace.id, 10),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-foreground-weak text-sm">
          Activity for{" "}
          <span className="text-foreground font-medium">{workspace.name}</span>{" "}
          over the last 7 days.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-foreground text-sm font-medium">This week</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Merged" value={counts.merged} accent="green" />
          <StatCard label="PR open" value={counts.pr_opened} accent="blue" />
          <StatCard label="Submitted" value={counts.submitted} accent="gray" />
          <StatCard label="Closed" value={counts.closed} accent="red" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-foreground text-sm font-medium">
            Recent feedback
          </h2>
          <Link
            href={`/${workspace.slug}/feedbacks`}
            className="text-foreground-weak hover:text-foreground text-xs"
          >
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-foreground-weak text-sm">
            No feedback yet. Open a run and use{" "}
            <em>Improve the Agent</em> to start one.
          </p>
        ) : (
          <ul className="border-border divide-border-weak divide-y rounded-lg border bg-surface-raised">
            {recent.map((f) => {
              const agentHref = `/${workspace.slug}/agents/${encodeURIComponent(f.agentName)}`;
              const runHref = `${agentHref}/runs/${f.runId}`;
              return (
                <li
                  key={f.id}
                  className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={agentHref}
                        className="text-foreground font-medium hover:underline"
                      >
                        {f.agentName}
                      </Link>
                      <StatusBadge status={f.status} />
                    </div>
                    <p className="text-foreground-weak line-clamp-2 text-xs leading-5">
                      {f.feedbackText}
                    </p>
                  </div>
                  <div className="text-foreground-weak flex shrink-0 flex-col items-end gap-1 text-xs">
                    <span>
                      <LocalTime iso={f.createdAt.toISOString()} />
                    </span>
                    <div className="flex gap-2">
                      <Link href={runHref} className="hover:underline">
                        Run
                      </Link>
                      {f.prUrl && (
                        <a
                          href={f.prUrl}
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
      </section>
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
    <div className="border-border bg-surface-raised flex flex-col gap-1 rounded-lg border px-4 py-3">
      <span className="text-foreground-weak text-xs font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-3xl font-bold tabular-nums ${accentClass}`}>
        {value}
      </span>
    </div>
  );
}

const ACCENT_CLASS: Record<"green" | "blue" | "gray" | "red", string> = {
  green: "text-sentiment-positive",
  blue: "text-[var(--color-blue-600)]",
  gray: "text-foreground",
  red: "text-sentiment-negative",
};

function StatusBadge({ status }: { status: FeedbackStatus }) {
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
