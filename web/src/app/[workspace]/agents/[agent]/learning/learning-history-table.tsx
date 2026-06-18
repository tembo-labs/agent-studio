"use client";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

// Plain-data row passed from the server page — no Date objects, no functions.
export type LearningHistoryRow = {
  improvementId: string;
  createdAtIso: string;
  correctedCount: number;
  signalCount: number;
  status: string;
  prUrl: string | null;
  prNumber: number | null;
  commitUrl: string | null;
  temboTaskHtmlUrl: string | null;
};

const COLUMNS: Column<LearningHistoryRow>[] = [
  {
    key: "when",
    header: "When",
    tdClassName: "text-foreground-weak text-sm align-top",
    cell: (r) => <LocalTime iso={r.createdAtIso} style="relative" />,
  },
  {
    key: "signals",
    header: "Signals",
    tdClassName: "text-foreground text-sm align-top",
    cell: (r) => (
      <>
        {r.correctedCount} correction{r.correctedCount === 1 ? "" : "s"}
        {r.signalCount > r.correctedCount && (
          <span className="text-foreground-muted">
            {" "}(+{r.signalCount - r.correctedCount} confirmed)
          </span>
        )}
      </>
    ),
  },
  {
    key: "status",
    header: "Status",
    tdClassName: "align-top",
    cell: (r) => (
      <Badge
        variant={
          r.status === "merged" || r.status === "committed"
            ? "green"
            : r.status === "closed"
              ? "red"
              : "blue"
        }
        size="small"
      >
        {r.status}
      </Badge>
    ),
  },
  {
    key: "pr",
    header: "PR",
    tdClassName: "text-sm align-top",
    cell: (r) => (
      <div className="flex flex-wrap gap-2">
        {r.prUrl && (
          <a
            href={r.prUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground hover:underline"
          >
            PR #{r.prNumber} ↗
          </a>
        )}
        {r.commitUrl && (
          <a
            href={r.commitUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground hover:underline"
          >
            Commit ↗
          </a>
        )}
        {!r.prUrl && !r.commitUrl && r.temboTaskHtmlUrl && (
          <a
            href={r.temboTaskHtmlUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground hover:underline"
          >
            Tembo Session ↗
          </a>
        )}
      </div>
    ),
  },
];

export function LearningHistoryTable({ rows }: { rows: LearningHistoryRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      getRowKey={(r) => r.improvementId}
      // Rows are not navigable — links inside each row handle navigation.
    />
  );
}
