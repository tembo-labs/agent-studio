"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { IconPlusLarge } from "central-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Shape we accept from the server. Server-only types (AgentSpec et al)
// don't cross the boundary — the server flattens to these plain shapes.
export type GridAgent =
  | {
      ok: true;
      path: string;
      filename: string;
      name: string;
      frameworkLabel: string;
      model: string | null;
      detailHref: string;
      lastRun:
        | {
            status: "queued" | "running" | "succeeded" | "failed";
            createdAtIso: string;
          }
        | null;
    }
  | {
      ok: false;
      path: string;
      filename: string;
      error: string;
      detail?: string;
    };

type Props = {
  agents: GridAgent[];
  newAgentHref: string;
};

export function AgentsGrid({ agents, newAgentHref }: Props) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => {
      const haystack = a.ok ? a.name : a.filename;
      return haystack.toLowerCase().includes(q);
    });
  }, [agents, deferred]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          type="search"
          placeholder="Search agents…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
          aria-label="Search agents"
        />
        <div className="flex items-center gap-3">
          <span className="text-foreground-muted text-xs">
            {filtered.length === agents.length
              ? `${agents.length} agent${agents.length === 1 ? "" : "s"}`
              : `Showing ${filtered.length} of ${agents.length}`}
          </span>
          <Button asChild>
            <Link href={newAgentHref}>
              <IconPlusLarge size={16} />
              <span>New agent</span>
            </Link>
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm">
          {agents.length === 0
            ? "No agents yet."
            : "No agents match this search."}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <li key={agent.path}>
              <AgentCard agent={agent} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: GridAgent }) {
  if (!agent.ok) {
    return (
      <div className="bg-surface-raised border-border flex h-full flex-col gap-2 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-foreground text-sm font-medium">
            {agent.filename}
          </span>
          <StatusDot tone="error" label="Invalid" />
        </div>
        <p className="text-sentiment-negative text-xs">
          {agent.error}
          {agent.detail ? ` — ${agent.detail}` : ""}
        </p>
      </div>
    );
  }

  return (
    <Link
      href={agent.detailHref}
      className="bg-surface-raised border-border hover:border-border-strong flex h-full flex-col gap-3 rounded-2xl border p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-foreground text-sm font-semibold">
          {agent.name}
        </span>
        <LastRunDot run={agent.lastRun} />
      </div>

      <div className="text-foreground-weak text-xs">
        {agent.lastRun ? (
          <>
            Last run{" "}
            <RelativeAgo iso={agent.lastRun.createdAtIso} />
          </>
        ) : (
          <span className="text-foreground-muted">No runs yet</span>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Badge variant="blue" size="small">
          {agent.frameworkLabel}
        </Badge>
        <Badge variant="purple" size="small">
          {agent.model ?? "—"}
        </Badge>
      </div>
    </Link>
  );
}

function LastRunDot({
  run,
}: {
  run: { status: "queued" | "running" | "succeeded" | "failed" } | null;
}) {
  if (!run) return <StatusDot tone="muted" label="No runs" />;
  switch (run.status) {
    case "succeeded":
      return <StatusDot tone="success" label="Succeeded" />;
    case "failed":
      return <StatusDot tone="error" label="Failed" />;
    case "queued":
      return <StatusDot tone="pending" label="Queued" />;
    case "running":
      return <StatusDot tone="pending" label="Running" />;
  }
}

function StatusDot({
  tone,
  label,
}: {
  tone: "success" | "error" | "pending" | "muted";
  label: string;
}) {
  const color =
    tone === "success"
      ? "bg-[var(--color-sentiment-positive)]"
      : tone === "error"
        ? "bg-[var(--color-sentiment-negative)]"
        : tone === "pending"
          ? "bg-[var(--color-blue-500)]"
          : "bg-[var(--color-foreground-muted)]";
  return (
    <span className="text-foreground-weak inline-flex items-center gap-1 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  );
}

// Tiny tz-friendly "X ago". Server renders the absolute fallback, client
// upgrades after hydration. Suppress mismatch warnings since the swap is
// deliberate.
function RelativeAgo({ iso }: { iso: string }) {
  return (
    <span title={new Date(iso).toLocaleString()} suppressHydrationWarning>
      {formatRelativeAgo(iso)}
    </span>
  );
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
