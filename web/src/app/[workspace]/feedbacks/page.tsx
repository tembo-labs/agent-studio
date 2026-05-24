import { notFound } from "next/navigation";
import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { feedbackSubmitterLabel } from "@/lib/feedback-display";
import { scanFeedbacksForPRs } from "@/lib/feedback-scan";
import {
  listFeedbacks,
  type Feedback,
  type FeedbackStatus,
} from "@/lib/feedbacks-api";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function FeedbacksPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const stored = await listFeedbacks(workspace.id);
  // Refresh status from GitHub on every page visit. Trades GitHub
  // API hits for staleness; fine for dev scale, swap to a webhook
  // when traffic grows.
  const feedbacks = await scanFeedbacksForPRs(workspace.id, stored);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Feedbacks
        </h1>
        <p className="text-foreground-weak text-sm">
          Each row is a feedback submission from a run&apos;s
          &ldquo;Improve the Agent&rdquo; form. Status updates when a Tembo
          task opens a PR and when that PR is merged.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {feedbacks.length === 0 ? (
        <p className="text-foreground-weak text-sm">
          No feedbacks yet. Open a run, scroll to{" "}
          <em>Improve the Agent</em>, and submit feedback to start one.
        </p>
      ) : (
        <FeedbackTable feedbacks={feedbacks} workspaceSlug={workspace.slug} />
      )}
    </div>
  );
}

function FeedbackTable({
  feedbacks,
  workspaceSlug,
}: {
  feedbacks: Feedback[];
  workspaceSlug: string;
}) {
  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-surface-secondary text-foreground-weak text-xs uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Agent</th>
            <th className="px-3 py-2 text-left font-medium">Feedback</th>
            <th className="px-3 py-2 text-left font-medium">By</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-left font-medium">Submitted</th>
            <th className="px-3 py-2 text-left font-medium">Links</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-weak)]">
          {feedbacks.map((f) => (
            <FeedbackRow
              key={f.id}
              feedback={f}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeedbackRow({
  feedback,
  workspaceSlug,
}: {
  feedback: Feedback;
  workspaceSlug: string;
}) {
  const agentHref = `/${workspaceSlug}/agents/${encodeURIComponent(feedback.agentName)}`;
  const runHref = `${agentHref}/runs/${feedback.runId}`;
  return (
    <tr className="bg-surface-raised">
      <td className="px-3 py-2 align-top">
        <Link
          href={agentHref}
          className="text-foreground font-medium hover:underline"
        >
          {feedback.agentName}
        </Link>
      </td>
      <td className="text-foreground max-w-md px-3 py-2 align-top">
        <span className="line-clamp-2 leading-5">{feedback.feedbackText}</span>
      </td>
      <td className="text-foreground px-3 py-2 align-top text-xs">
        {feedbackSubmitterLabel(feedback)}
      </td>
      <td className="px-3 py-2 align-top">
        <StatusBadge status={feedback.status} />
      </td>
      <td className="text-foreground-weak px-3 py-2 align-top text-xs">
        <LocalTime iso={feedback.createdAt.toISOString()} />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href={runHref} className="text-foreground hover:underline">
            Run
          </Link>
          {feedback.temboTaskHtmlUrl && (
            <a
              href={feedback.temboTaskHtmlUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground hover:underline"
            >
              Tembo task ↗
            </a>
          )}
          {feedback.prUrl && (
            <a
              href={feedback.prUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground hover:underline"
            >
              PR #{feedback.prNumber} ↗
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

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
