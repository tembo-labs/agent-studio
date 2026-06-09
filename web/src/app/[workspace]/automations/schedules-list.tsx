"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
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

      {filtered.length === 0 ? (
        <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
          {automations.length === 0
            ? "No schedules yet. Click New schedule to run an agent on a cron."
            : "No schedules match these filters."}
        </p>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-foreground-weak text-sm uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Agent</th>
                <th className="px-3 py-2 text-left font-medium">Schedule</th>
                <th className="px-3 py-2 text-left font-medium">Next fire</th>
                <th className="px-3 py-2 text-left font-medium">Last fire</th>
                <th className="px-3 py-2 text-left font-medium">Run as</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-weak)]">
              {filtered.map((a) => (
                <ScheduleRow
                  key={a.id}
                  automation={a}
                  workspaceSlug={workspaceSlug}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScheduleRow({
  automation,
  workspaceSlug,
}: {
  automation: Automation;
  workspaceSlug: string;
}) {
  const preview = validateCron(automation.cron);
  const nextFire = automation.enabled
    ? nextFireAfter(automation.cron, new Date())
    : null;
  const agentHref = `/${workspaceSlug}/agents/${encodeURIComponent(automation.agentName)}`;
  const editHref = `/${workspaceSlug}/automations/${automation.id}`;
  return (
    <tr className="bg-surface-raised">
      <td className="px-3 py-2 align-top">
        <Link
          href={editHref}
          className="text-foreground font-medium hover:underline"
        >
          {automation.name}
        </Link>
      </td>
      <td className="px-3 py-2 align-top">
        <Link href={agentHref} className="text-foreground hover:underline">
          {automation.agentName}
        </Link>
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col gap-0.5">
          <code className="text-foreground text-sm">{automation.cron}</code>
          {preview.ok && (
            <span className="text-foreground-weak text-sm">
              {preview.humanReadable}{" "}
              <span className="text-foreground-muted">(UTC)</span>
            </span>
          )}
        </div>
      </td>
      <td className="text-foreground-weak px-3 py-2 align-top text-sm">
        {nextFire ? (
          <LocalTime iso={nextFire.toISOString()} style="relative" />
        ) : (
          <span className="text-foreground-muted">—</span>
        )}
      </td>
      <td className="text-foreground-weak px-3 py-2 align-top text-sm">
        {automation.lastFiredAt ? (
          <LocalTime
            iso={new Date(automation.lastFiredAt).toISOString()}
            style="relative"
          />
        ) : (
          <span className="text-foreground-muted">Never</span>
        )}
      </td>
      <td className="text-foreground-weak px-3 py-2 align-top text-sm">
        {ownerOf(automation)}
      </td>
      <td className="px-3 py-2 align-top">
        <StatusBadge automation={automation} />
        {automation.lastFireError && (
          <p className="text-sentiment-negative mt-1 max-w-[220px] text-sm leading-4">
            {automation.lastFireError}
          </p>
        )}
      </td>
      <td className="px-3 py-2 text-right align-top">
        <div className="flex justify-end gap-2">
          <ToggleEnabledForm
            workspaceSlug={workspaceSlug}
            id={automation.id}
            enabled={automation.enabled}
          />
          <Link
            href={editHref}
            className="text-foreground-weak hover:text-foreground text-sm"
          >
            Edit
          </Link>
        </div>
      </td>
    </tr>
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
