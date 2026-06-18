"use client";

import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

// Client table for the Improvements page. The server page does the PR scan +
// fetch, then hands plain-data rows here so the shared DataTable can own the
// chrome, row hover, and whole-row click (→ the run, or the agent).

type ImprovementStatus =
  | "submitted"
  | "pr_opened"
  | "merged"
  | "closed"
  | "committed";

export type ImprovementRow = {
  id: string;
  agentName: string;
  text: string;
  submitter: string;
  status: ImprovementStatus;
  source: string;
  createdAtIso: string;
  agentHref: string;
  runHref: string | null;
  temboTaskHtmlUrl: string | null;
  prUrl: string | null;
  prNumber: number | null;
  commitUrl: string | null;
};

export function ImprovementsTable({ rows }: { rows: ImprovementRow[] }) {
  const columns: Column<ImprovementRow>[] = [
    {
      key: "agent",
      header: "Agent",
      cell: (r) => (
        <>
          <Link
            href={r.agentHref}
            className="text-foreground font-medium hover:underline"
          >
            {r.agentName}
          </Link>
          {r.source === "learning" && (
            <span className="mt-1 block">
              <Badge variant="blue" size="small">
                Learning
              </Badge>
            </span>
          )}
        </>
      ),
    },
    {
      key: "text",
      header: "Improvement",
      tdClassName: "max-w-md text-foreground",
      cell: (r) => <span className="line-clamp-2 leading-5">{r.text}</span>,
    },
    {
      key: "by",
      header: "By",
      tdClassName: "text-foreground text-sm",
      cell: (r) => r.submitter,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "submitted",
      header: "Submitted",
      tdClassName: "text-foreground-weak text-sm",
      cell: (r) => <LocalTime iso={r.createdAtIso} style="relative" />,
    },
    {
      key: "links",
      header: "Links",
      cell: (r) => (
        <div className="flex flex-wrap gap-2 text-sm">
          {r.runHref && (
            <Link href={r.runHref} className="text-foreground hover:underline">
              Run
            </Link>
          )}
          {r.temboTaskHtmlUrl && (
            <a
              href={r.temboTaskHtmlUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground hover:underline"
            >
              Tembo Session ↗
            </a>
          )}
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
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      rowHref={(r) => r.runHref ?? r.agentHref}
    />
  );
}

function StatusBadge({ status }: { status: ImprovementStatus }) {
  switch (status) {
    case "submitted":
      return <Badge variant="gray" size="small">Submitted</Badge>;
    case "pr_opened":
      return <Badge variant="blue" size="small">PR opened</Badge>;
    case "merged":
      return <Badge variant="green" size="small">Merged</Badge>;
    case "committed":
      return <Badge variant="green" size="small">Committed</Badge>;
    case "closed":
      return <Badge variant="red" size="small">Closed</Badge>;
  }
}
