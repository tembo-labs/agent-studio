// Prior improvements submitted from this run. Rendered above the
// Improve form on the run detail page so the user can see whether
// their earlier submission is in flight / has opened a PR / has been
// merged — without having to click through to /improvements.

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { improvementSubmitterLabel } from "@/lib/improvement-display";
import {
  type Improvement,
  type ImprovementStatus,
} from "@/lib/improvements-api";

export function ImprovementHistory({
  improvements,
}: {
  improvements: Improvement[];
}) {
  if (improvements.length === 0) return null;

  return (
    <ul className="divide-border-weak flex flex-col divide-y rounded-lg border border-[var(--color-border-weak)] bg-surface-raised">
      {improvements.map((i) => (
        <li key={i.id} className="flex flex-col gap-1.5 px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-foreground line-clamp-3 text-sm leading-5">
              {i.improvementText}
            </p>
            <StatusBadge status={i.status} />
          </div>
          <div className="text-foreground-weak flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-foreground font-medium">
              {improvementSubmitterLabel(i)}
            </span>
            <span>
              <LocalTime iso={i.createdAt.toISOString()} />
            </span>
            {i.temboTaskHtmlUrl && (
              <a
                href={i.temboTaskHtmlUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground hover:underline"
              >
                Tembo Session ↗
              </a>
            )}
            {i.prUrl && (
              <a
                href={i.prUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground hover:underline"
              >
                PR #{i.prNumber} ↗
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
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
