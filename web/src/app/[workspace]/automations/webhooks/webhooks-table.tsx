"use client";

import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

// Client table for the workspace Webhooks page. The server page fetches rows
// and maps them to plain data (no Date objects) before passing them here, so
// DataTable's cell functions stay in this client component.

export type WebhookRow = {
  id: string;
  agentName: string;
  name: string;
  tokenLast4: string;
  enabled: boolean;
  lastFiredAtIso: string | null;
  lastFireError: string | null;
  agentAutomationHref: string;
};

const columns: Column<WebhookRow>[] = [
  {
    key: "agent",
    header: "Agent",
    cell: (w) => (
      <Link
        href={w.agentAutomationHref}
        className="text-foreground font-medium hover:underline"
      >
        {w.agentName}
      </Link>
    ),
  },
  {
    key: "name",
    header: "Name",
    tdClassName: "text-foreground",
    cell: (w) => w.name,
  },
  {
    key: "token",
    header: "Token",
    tdClassName: "text-foreground-muted font-mono text-sm",
    cell: (w) => `••••${w.tokenLast4}`,
  },
  {
    key: "lastFired",
    header: "Last fired",
    tdClassName: "text-foreground-weak text-sm",
    cell: (w) =>
      w.lastFiredAtIso ? (
        <LocalTime iso={w.lastFiredAtIso} style="relative" />
      ) : (
        <span className="text-foreground-muted">Never</span>
      ),
  },
  {
    key: "status",
    header: "Status",
    cell: (w) => {
      if (!w.enabled)
        return (
          <Badge variant="gray" size="small">
            Disabled
          </Badge>
        );
      if (w.lastFireError)
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

export function WebhooksTable({
  rows,
  empty,
}: {
  rows: WebhookRow[];
  empty: React.ReactNode;
}) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(w) => w.id}
      empty={empty}
    />
  );
}
