"use client";

import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

// Client table for the workspace Triggers page. The server page fetches rows
// and maps them to plain data (no Date objects) before passing them here, so
// DataTable's cell functions stay in this client component.

export type TriggerRow = {
  id: string;
  agentName: string;
  toolkitSlug: string;
  triggerType: string;
  enabled: boolean;
  lastFiredAtIso: string | null;
  lastFireError: string | null;
  agentAutomationHref: string;
};

const columns: Column<TriggerRow>[] = [
  {
    key: "agent",
    header: "Agent",
    cell: (t) => (
      <Link
        href={t.agentAutomationHref}
        className="text-foreground font-medium hover:underline"
      >
        {t.agentName}
      </Link>
    ),
  },
  {
    key: "toolkit",
    header: "Toolkit",
    tdClassName: "text-foreground",
    cell: (t) => t.toolkitSlug,
  },
  {
    key: "event",
    header: "Event",
    tdClassName: "text-foreground-weak font-mono text-sm",
    cell: (t) => t.triggerType,
  },
  {
    key: "lastFired",
    header: "Last fired",
    tdClassName: "text-foreground-weak text-sm",
    cell: (t) =>
      t.lastFiredAtIso ? (
        <LocalTime iso={t.lastFiredAtIso} style="relative" />
      ) : (
        <span className="text-foreground-muted">Never</span>
      ),
  },
  {
    key: "status",
    header: "Status",
    cell: (t) => {
      if (!t.enabled)
        return (
          <Badge variant="gray" size="small">
            Disabled
          </Badge>
        );
      if (t.lastFireError)
        return (
          <Badge variant="red" size="small">
            Error
          </Badge>
        );
      return (
        <Badge variant="green" size="small">
          Enabled
        </Badge>
      );
    },
  },
];

export function TriggersTable({
  rows,
  empty,
}: {
  rows: TriggerRow[];
  empty: React.ReactNode;
}) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(t) => t.id}
      empty={empty}
    />
  );
}
