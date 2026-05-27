"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { IconPlusLarge } from "central-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Workspace agent inventory. Replaces the card grid (better for ~10
// agents, falls apart past that) with a sortable / filterable table.
// Status facet pills + free-text search live above; the table itself
// renders every agent — live, pending-create, and invalid — as a
// single row so the user sees the whole picture in one place.

export type InventoryAgent =
  | {
      kind: "live";
      // Used as the React key. Stable across renders.
      path: string;
      filename: string;
      name: string;
      detailHref: string;
      frameworkLabel: string;
      model: string | null;
      /** 30-day window. Zero when the agent has never run in that window. */
      runs30d: number;
      succeeded30d: number;
      failed30d: number;
      /** Latest run regardless of window. Null when never run. */
      lastRun:
        | {
            status: "queued" | "running" | "succeeded" | "failed";
            createdAtIso: string;
          }
        | null;
    }
  | {
      kind: "invalid";
      path: string;
      filename: string;
      error: string;
      detail?: string;
    }
  | {
      kind: "pending-create";
      // Unique key (improvement row id).
      key: string;
      name: string;
      path: string;
      frameworkLabel: string;
      createdAtIso: string;
      status: "submitted" | "pr_opened";
      temboTaskHtmlUrl: string | null;
      prUrl: string | null;
      prNumber: number | null;
    };

type StatusBucket = "active" | "idle" | "error" | "pending" | "invalid";

type SortKey =
  | "status"
  | "name"
  | "runs"
  | "success"
  | "last-run";

type SortDir = "asc" | "desc";

type Props = {
  agents: InventoryAgent[];
  newAgentHref: string;
  /** Viewers see the inventory but not the "New agent" button. */
  canEdit: boolean;
};

export function AgentsInventory({ agents, newAgentHref, canEdit }: Props) {
  const [query, setQuery] = useState("");
  // null = "all" (no facet selected). Selecting a pill switches the
  // visible rows to that bucket only.
  const [bucket, setBucket] = useState<StatusBucket | null>(null);
  // Default sort: erroring rows surface first, then most-recently-
  // active. The user can re-sort by clicking column headers.
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const enriched = useMemo(
    () => agents.map((a) => ({ agent: a, bucket: statusBucket(a) })),
    [agents],
  );

  const counts = useMemo(() => {
    const c: Record<StatusBucket | "all", number> = {
      all: enriched.length,
      active: 0,
      idle: 0,
      error: 0,
      pending: 0,
      invalid: 0,
    };
    for (const { bucket } of enriched) c[bucket]++;
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filteredByText = q
      ? enriched.filter(({ agent }) =>
          searchHaystack(agent).toLowerCase().includes(q),
        )
      : enriched;
    const filteredByBucket =
      bucket === null
        ? filteredByText
        : filteredByText.filter((e) => e.bucket === bucket);
    return [...filteredByBucket].sort((a, b) =>
      compareRows(a.agent, b.agent, a.bucket, b.bucket, sortKey, sortDir),
    );
  }, [enriched, query, bucket, sortKey, sortDir]);

  function onHeaderClick(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Most columns are most useful when sorted with the "worst" or
      // "newest" at the top: error/invalid first, biggest run count
      // first, lowest success rate first, newest activity first.
      setSortDir(
        key === "name"
          ? "asc"
          : key === "status"
            ? "asc"
            : key === "runs" || key === "last-run"
              ? "desc"
              : "asc",
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          type="search"
          placeholder="Search agents…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
          aria-label="Search agents"
        />
        {canEdit && (
          <Button asChild>
            <Link href={newAgentHref}>
              <IconPlusLarge size={16} />
              <span>New agent</span>
            </Link>
          </Button>
        )}
      </div>

      <FacetPills counts={counts} active={bucket} onChange={setBucket} />

      {filtered.length === 0 ? (
        <div className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm">
          {agents.length === 0
            ? "No agents yet."
            : "No agents match these filters."}
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-foreground-weak text-xs uppercase tracking-wide">
              <tr>
                <SortableTh
                  label="Status"
                  active={sortKey === "status"}
                  dir={sortDir}
                  onClick={() => onHeaderClick("status")}
                  className="w-[140px]"
                />
                <SortableTh
                  label="Name"
                  active={sortKey === "name"}
                  dir={sortDir}
                  onClick={() => onHeaderClick("name")}
                />
                <th className="px-3 py-2 text-left font-medium">Framework</th>
                <th className="px-3 py-2 text-left font-medium">Model</th>
                <SortableTh
                  label="Runs 30d"
                  active={sortKey === "runs"}
                  dir={sortDir}
                  onClick={() => onHeaderClick("runs")}
                  className="text-right"
                />
                <SortableTh
                  label="Success"
                  active={sortKey === "success"}
                  dir={sortDir}
                  onClick={() => onHeaderClick("success")}
                  className="text-right"
                />
                <SortableTh
                  label="Last run"
                  active={sortKey === "last-run"}
                  dir={sortDir}
                  onClick={() => onHeaderClick("last-run")}
                  className="text-right"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-weak)]">
              {filtered.map(({ agent, bucket }) => (
                <InventoryRow
                  key={rowKey(agent)}
                  agent={agent}
                  bucket={bucket}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FacetPills({
  counts,
  active,
  onChange,
}: {
  counts: Record<StatusBucket | "all", number>;
  active: StatusBucket | null;
  onChange: (b: StatusBucket | null) => void;
}) {
  const pills: Array<{ key: StatusBucket | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "idle", label: "Idle" },
    { key: "error", label: "Error" },
    { key: "pending", label: "Pending" },
    { key: "invalid", label: "Invalid" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pills.map(({ key, label }) => {
        const count = counts[key];
        if (key !== "all" && count === 0) return null;
        const isActive =
          (key === "all" && active === null) || key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key === "all" ? null : (key as StatusBucket))}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              isActive
                ? "border-foreground bg-surface-raised text-foreground"
                : "border-border bg-surface text-foreground-weak hover:text-foreground"
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                isActive
                  ? "bg-surface text-foreground-weak"
                  : "bg-surface-secondary text-foreground-muted"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2 text-left font-medium ${className ?? ""}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-wide ${
          active
            ? "text-foreground"
            : "text-foreground-weak hover:text-foreground"
        }`}
      >
        {label}
        <span className="text-[10px]" aria-hidden>
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function InventoryRow({
  agent,
  bucket,
}: {
  agent: InventoryAgent;
  bucket: StatusBucket;
}) {
  if (agent.kind === "invalid") {
    return (
      <tr className="bg-[var(--color-input-error)]/30">
        <td className="px-3 py-2 align-middle">
          <StatusCell bucket="invalid" />
        </td>
        <td className="px-3 py-2 align-middle">
          <span className="text-foreground font-mono text-xs">
            {agent.filename}
          </span>
        </td>
        <td
          className="text-sentiment-negative px-3 py-2 align-middle text-xs"
          colSpan={5}
        >
          {agent.error}
          {agent.detail ? ` — ${agent.detail}` : ""}
        </td>
      </tr>
    );
  }
  if (agent.kind === "pending-create") {
    return (
      <tr>
        <td className="px-3 py-2 align-middle">
          <StatusCell bucket="pending" />
        </td>
        <td className="px-3 py-2 align-middle">
          <span className="text-foreground text-sm font-medium">
            {agent.name}
          </span>
        </td>
        <td className="px-3 py-2 align-middle">
          <Badge variant="gray" size="small">
            {agent.frameworkLabel}
          </Badge>
        </td>
        <td className="text-foreground-muted px-3 py-2 align-middle text-xs">
          —
        </td>
        <td className="text-foreground-muted px-3 py-2 text-right align-middle text-xs">
          —
        </td>
        <td className="text-foreground-muted px-3 py-2 text-right align-middle text-xs">
          —
        </td>
        <td className="text-foreground-weak px-3 py-2 text-right align-middle text-xs">
          <PendingLinks agent={agent} />
        </td>
      </tr>
    );
  }

  const successRate =
    agent.runs30d > 0 ? agent.succeeded30d / agent.runs30d : null;
  return (
    <tr className="hover:bg-surface-secondary transition-colors">
      <td className="px-3 py-2 align-middle">
        <StatusCell bucket={bucket} />
      </td>
      <td className="px-3 py-2 align-middle">
        <Link
          href={agent.detailHref}
          className="text-foreground hover:underline font-medium"
        >
          {agent.name}
        </Link>
      </td>
      <td className="px-3 py-2 align-middle">
        <Badge variant="gray" size="small">
          {agent.frameworkLabel}
        </Badge>
      </td>
      <td className="text-foreground-weak px-3 py-2 align-middle font-mono text-xs">
        {agent.model ?? "—"}
      </td>
      <td className="text-foreground px-3 py-2 text-right align-middle font-mono text-xs">
        {agent.runs30d.toLocaleString("en-US")}
      </td>
      <td className="px-3 py-2 text-right align-middle font-mono text-xs">
        {successRate === null ? (
          <span className="text-foreground-muted">—</span>
        ) : (
          <SuccessCell rate={successRate} failed={agent.failed30d} />
        )}
      </td>
      <td className="text-foreground-weak px-3 py-2 text-right align-middle text-xs">
        {agent.lastRun ? (
          <span
            title={new Date(agent.lastRun.createdAtIso).toLocaleString()}
            suppressHydrationWarning
          >
            {formatRelativeAgo(agent.lastRun.createdAtIso)}
          </span>
        ) : (
          <span className="text-foreground-muted">Never</span>
        )}
      </td>
    </tr>
  );
}

function SuccessCell({ rate, failed }: { rate: number; failed: number }) {
  const pct = Math.round(rate * 100);
  const tone =
    failed === 0
      ? "text-foreground"
      : rate >= 0.95
        ? "text-foreground"
        : rate >= 0.8
          ? "text-foreground-weak"
          : "text-sentiment-negative";
  return <span className={tone}>{pct}%</span>;
}

function StatusCell({ bucket }: { bucket: StatusBucket }) {
  const meta = STATUS_META[bucket];
  return (
    <span className="text-foreground-weak inline-flex items-center gap-1.5 text-xs">
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dotClass}`}
        aria-hidden
      />
      {meta.label}
    </span>
  );
}

function PendingLinks({
  agent,
}: {
  agent: Extract<InventoryAgent, { kind: "pending-create" }>;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {agent.prUrl && agent.prNumber !== null ? (
        <a
          href={agent.prUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-foreground hover:underline"
        >
          PR #{agent.prNumber} ↗
        </a>
      ) : null}
      {agent.temboTaskHtmlUrl ? (
        <a
          href={agent.temboTaskHtmlUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-foreground-weak hover:text-foreground hover:underline"
        >
          Tembo session ↗
        </a>
      ) : null}
    </span>
  );
}

const STATUS_META: Record<
  StatusBucket,
  { label: string; dotClass: string; order: number }
> = {
  error: {
    label: "Error",
    dotClass: "bg-[var(--color-sentiment-negative)]",
    order: 0,
  },
  invalid: {
    label: "Invalid",
    dotClass: "bg-[var(--color-sentiment-negative)]",
    order: 1,
  },
  pending: {
    label: "Pending",
    dotClass: "bg-[var(--color-blue-500)]",
    order: 2,
  },
  active: {
    label: "Active",
    dotClass: "bg-[var(--color-sentiment-positive)]",
    order: 3,
  },
  idle: {
    label: "Idle",
    dotClass: "bg-[var(--color-foreground-muted)]",
    order: 4,
  },
};

function statusBucket(a: InventoryAgent): StatusBucket {
  if (a.kind === "invalid") return "invalid";
  if (a.kind === "pending-create") return "pending";
  if (a.lastRun?.status === "failed") return "error";
  if (a.runs30d === 0) return "idle";
  return "active";
}

function searchHaystack(a: InventoryAgent): string {
  if (a.kind === "invalid") return a.filename;
  return a.name;
}

function rowKey(a: InventoryAgent): string {
  if (a.kind === "pending-create") return `pending:${a.key}`;
  return a.path;
}

function compareRows(
  a: InventoryAgent,
  b: InventoryAgent,
  bucketA: StatusBucket,
  bucketB: StatusBucket,
  key: SortKey,
  dir: SortDir,
): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (key) {
    case "status": {
      const d = STATUS_META[bucketA].order - STATUS_META[bucketB].order;
      if (d !== 0) return d * sign;
      return compareNames(a, b);
    }
    case "name":
      return compareNames(a, b) * sign;
    case "runs": {
      const ra = rowRuns(a);
      const rb = rowRuns(b);
      if (ra !== rb) return (ra - rb) * sign;
      return compareNames(a, b);
    }
    case "success": {
      const ra = rowSuccessRate(a);
      const rb = rowSuccessRate(b);
      // Nulls last so "no data" doesn't crowd the top.
      if (ra === null && rb === null) return compareNames(a, b);
      if (ra === null) return 1;
      if (rb === null) return -1;
      if (ra !== rb) return (ra - rb) * sign;
      return compareNames(a, b);
    }
    case "last-run": {
      const ta = rowLastRunMs(a);
      const tb = rowLastRunMs(b);
      if (ta === null && tb === null) return compareNames(a, b);
      if (ta === null) return 1;
      if (tb === null) return -1;
      if (ta !== tb) return (ta - tb) * sign;
      return compareNames(a, b);
    }
  }
}

function rowRuns(a: InventoryAgent): number {
  if (a.kind === "live") return a.runs30d;
  return -1; // pending + invalid sink to the bottom on numeric sorts
}

function rowSuccessRate(a: InventoryAgent): number | null {
  if (a.kind !== "live" || a.runs30d === 0) return null;
  return a.succeeded30d / a.runs30d;
}

function rowLastRunMs(a: InventoryAgent): number | null {
  if (a.kind === "live" && a.lastRun) {
    return new Date(a.lastRun.createdAtIso).getTime();
  }
  if (a.kind === "pending-create") {
    return new Date(a.createdAtIso).getTime();
  }
  return null;
}

function compareNames(a: InventoryAgent, b: InventoryAgent): number {
  const an = a.kind === "invalid" ? a.filename : a.name;
  const bn = b.kind === "invalid" ? b.filename : b.name;
  return an.localeCompare(bn);
}

function formatRelativeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}
