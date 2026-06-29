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
  /** Count of agents this member owns (agent_owner rows pointing at them). */
  agentsOwned: number;
  /** Their owned agent names, sorted — revealed on hover. */
  ownedAgents: string[];
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
    key: "agents",
    header: "Agents owned",
    align: "right",
    cell: (r) => (
      <CountCell
        value={r.agentsOwned}
        items={r.ownedAgents}
        empty="Owns no agents"
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

export function DashboardTeamTable({
  rows,
  unownedCount,
  unownedAgents,
}: {
  rows: TeamRow[];
  /** Agents in the repo with no owner row — surfaced as a footer note so it's
   *  obvious which agents nobody is accountable for. */
  unownedCount: number;
  unownedAgents: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowKey={(r) => r.userId}
        // No whole-row navigation — member link (admin) is inside the cell.
      />
      <div className="text-foreground-muted px-1 text-sm">
        {unownedCount === 0 ? (
          "Every agent has an owner."
        ) : (
          <>
            <CountCell
              value={unownedCount}
              items={unownedAgents}
              empty="No unowned agents"
            />{" "}
            {unownedCount === 1 ? "agent is" : "agents are"} unowned.
          </>
        )}
      </div>
    </div>
  );
}
