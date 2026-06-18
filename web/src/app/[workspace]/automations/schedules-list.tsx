"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { type Automation } from "@/lib/automations-api";
import { nextFireAfter, validateCron } from "@/lib/cron";

import { ToggleEnabledForm } from "./toggle-enabled-form";

// Workspace-wide schedules table with agent / run-as / status filters
// (client-side over the full list — there are rarely enough schedules to
// warrant server pagination).

type StatusFilter = "all" | "enabled" | "disabled" | "error";

function ownerOf(a: Automation): string {
  return a.ownerUserName ?? a.ownerUserEmail ?? "—";
}

export function SchedulesList({
  automations,
  workspaceSlug,
}: {
  automations: Automation[];
  workspaceSlug: string;
}) {
  const [agent, setAgent] = useState("");
  const [runAs, setRunAs] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const agentOptions = useMemo(
    () => [
      { value: "", label: "All agents" },
      ...[...new Set(automations.map((a) => a.agentName))]
        .sort()
        .map((n) => ({ value: n, label: n })),
    ],
    [automations],
  );
  const ownerOptions = useMemo(
    () => [
      { value: "", label: "Anyone" },
      ...[...new Set(automations.map(ownerOf))]
        .sort()
        .map((o) => ({ value: o, label: o })),
    ],
    [automations],
  );

  const filtered = automations.filter((a) => {
    if (agent && a.agentName !== agent) return false;
    if (runAs && ownerOf(a) !== runAs) return false;
    if (status === "enabled" && !(a.enabled && !a.lastFireError)) return false;
    if (status === "disabled" && a.enabled) return false;
    if (status === "error" && !a.lastFireError) return false;
    return true;
  });

  const columns: Column<Automation>[] = [
    {
      key: "name",
      header: "Name",
      cell: (a) => {
        const editHref = `/${workspaceSlug}/automations/${a.id}`;
        return (
          <Link href={editHref} className="text-foreground font-medium hover:underline">
            {a.name}
          </Link>
        );
      },
    },
    {
      key: "agent",
      header: "Agent",
      cell: (a) => {
        const agentHref = `/${workspaceSlug}/agents/${encodeURIComponent(a.agentName)}`;
        return (
          <Link href={agentHref} className="text-foreground hover:underline">
            {a.agentName}
          </Link>
        );
      },
    },
    {
      key: "schedule",
      header: "Schedule",
      cell: (a) => {
        const preview = validateCron(a.cron);
        return (
          <div className="flex flex-col gap-0.5">
            <code className="text-foreground text-sm">{a.cron}</code>
            {preview.ok && (
              <span className="text-foreground-weak text-sm">
                {preview.humanReadable}{" "}
                <span className="text-foreground-muted">(UTC)</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "nextFire",
      header: "Next fire",
      tdClassName: "text-foreground-weak text-sm",
      cell: (a) => {
        const nextFire = a.enabled ? nextFireAfter(a.cron, new Date()) : null;
        return nextFire ? (
          <LocalTime iso={nextFire.toISOString()} style="relative" />
        ) : (
          <span className="text-foreground-muted">—</span>
        );
      },
    },
    {
      key: "lastFire",
      header: "Last fire",
      tdClassName: "text-foreground-weak text-sm",
      cell: (a) =>
        a.lastFiredAt ? (
          <LocalTime iso={new Date(a.lastFiredAt).toISOString()} style="relative" />
        ) : (
          <span className="text-foreground-muted">Never</span>
        ),
    },
    {
      key: "runAs",
      header: "Run as",
      tdClassName: "text-foreground-weak text-sm",
      cell: (a) => ownerOf(a),
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => (
        <>
          <StatusBadge automation={a} />
          {a.lastFireError && (
            <p className="text-sentiment-negative mt-1 max-w-[220px] text-sm leading-4">
              {a.lastFireError}
            </p>
          )}
        </>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (a) => {
        const editHref = `/${workspaceSlug}/automations/${a.id}`;
        return (
          <div className="flex justify-end gap-2">
            <ToggleEnabledForm
              workspaceSlug={workspaceSlug}
              id={a.id}
              enabled={a.enabled}
            />
            <Link
              href={editHref}
              className="text-foreground-weak hover:text-foreground text-sm"
            >
              Edit
            </Link>
          </div>
        );
      },
    },
  ];

  const emptyMessage =
    automations.length === 0
      ? "No schedules yet. Click New schedule to run an agent on a cron."
      : "No schedules match these filters.";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={agent}
          onValueChange={setAgent}
          options={agentOptions}
          ariaLabel="Filter by agent"
          className="min-w-[160px]"
        />
        <Select
          value={runAs}
          onValueChange={setRunAs}
          options={ownerOptions}
          ariaLabel="Filter by run-as owner"
          className="min-w-[160px]"
        />
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as StatusFilter)}
          options={[
            { value: "all", label: "Any status" },
            { value: "enabled", label: "Enabled" },
            { value: "disabled", label: "Disabled" },
            { value: "error", label: "Error" },
          ]}
          ariaLabel="Filter by status"
          className="min-w-[140px]"
        />
        <span className="text-foreground-weak ml-auto text-sm">
          {filtered.length} of {automations.length}
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getRowKey={(a) => a.id}
        rowHref={(a) => `/${workspaceSlug}/agents/${encodeURIComponent(a.agentName)}`}
        empty={
          <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
            {emptyMessage}
          </p>
        }
      />
    </div>
  );
}


function StatusBadge({ automation }: { automation: Automation }) {
  if (!automation.enabled) {
    return (
      <Badge variant="gray" size="small">
        Disabled
      </Badge>
    );
  }
  if (automation.lastFireError) {
    return (
      <Badge variant="red" size="small">
        Error
      </Badge>
    );
  }
  return (
    <Badge variant="green" size="small">
      Enabled
    </Badge>
  );
}
