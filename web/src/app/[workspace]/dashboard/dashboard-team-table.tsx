"use client";

import Link from "next/link";

import { DataTable, type Column } from "@/components/ui/data-table";

import { CountCell } from "./count-cell";

// Plain-data row passed from the server page — no Date objects, no functions.
export type TeamRow = {
  userId: string;
  label: string;
  /** Href to the member settings page, or null when the viewer is not an admin. */
  memberHref: string | null;
  connections: number;
  connectionLabels: string[];
  automations: number;
  automationAgents: string[];
  slackRuns30d: number;
  slackBots: string[];
  runs30d: number;
};

const COLUMNS: Column<TeamRow>[] = [
  {
    key: "member",
    header: "Member",
    cell: (r) =>
      r.memberHref ? (
        <Link
          href={r.memberHref}
          className="text-foreground font-medium hover:underline"
        >
          {r.label}
        </Link>
      ) : (
        <span className="text-foreground font-medium">{r.label}</span>
      ),
  },
  {
    key: "connections",
    header: "Connections",
    align: "right",
    cell: (r) => (
      <CountCell
        value={r.connections}
        items={r.connectionLabels}
        empty="No connections"
      />
    ),
  },
  {
    key: "automations",
    header: "Automations",
    align: "right",
    cell: (r) => (
      <CountCell
        value={r.automations}
        items={r.automationAgents}
        empty="No automations"
      />
    ),
  },
  {
    key: "slack",
    header: "Slack (30d)",
    align: "right",
    cell: (r) => (
      <CountCell
        value={r.slackRuns30d}
        items={r.slackBots}
        empty="No Slack runs"
      />
    ),
  },
  {
    key: "runs30d",
    header: "30d runs",
    align: "right",
    tdClassName: "text-foreground font-mono",
    cell: (r) => r.runs30d.toLocaleString("en-US"),
  },
];

export function DashboardTeamTable({ rows }: { rows: TeamRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      getRowKey={(r) => r.userId}
      // No whole-row navigation — member link (admin) is inside the cell.
    />
  );
}
