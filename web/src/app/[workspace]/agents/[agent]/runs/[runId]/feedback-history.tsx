// Prior feedbacks submitted from this run. Rendered above the
// Improve form on the run detail page so the user can see whether
// their earlier feedback is in flight / has opened a PR / has been
// merged — without having to click through to /feedbacks.

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { feedbackSubmitterLabel } from "@/lib/feedback-display";
import { type Feedback, type FeedbackStatus } from "@/lib/feedbacks-api";

export function FeedbackHistory({ feedbacks }: { feedbacks: Feedback[] }) {
  if (feedbacks.length === 0) return null;

  return (
    <ul className="divide-border-weak flex flex-col divide-y rounded-lg border border-[var(--color-border-weak)] bg-surface-raised">
      {feedbacks.map((f) => (
        <li key={f.id} className="flex flex-col gap-1.5 px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-foreground line-clamp-3 text-sm leading-5">
              {f.feedbackText}
            </p>
            <StatusBadge status={f.status} />
          </div>
          <div className="text-foreground-weak flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-foreground font-medium">
              {feedbackSubmitterLabel(f)}
            </span>
            <span>
              <LocalTime iso={f.createdAt.toISOString()} />
            </span>
            {f.temboTaskHtmlUrl && (
              <a
                href={f.temboTaskHtmlUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground hover:underline"
              >
                Tembo task ↗
              </a>
            )}
            {f.prUrl && (
              <a
                href={f.prUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground hover:underline"
              >
                PR #{f.prNumber} ↗
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
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
