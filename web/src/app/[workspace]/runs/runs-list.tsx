"use client";

// Client-side filter + paginate surface for /<workspace>/runs.
//
// Filters live entirely in component state (per the "no URL state to
// manage" tradeoff). The server page renders the initial page; this
// component takes over on any filter change or "Load more" click,
// calling loadRunsAction.

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/pricing";

import { loadRunsAction } from "./actions";
import type { LoadedRun } from "./shape";

type RunStatus = LoadedRun["status"];
type RunTrigger = LoadedRun["trigger"];

const ALL_STATUSES: RunStatus[] = ["queued", "running", "succeeded", "failed"];
const ALL_TRIGGERS: RunTrigger[] = ["manual", "schedule", "event"];
const PAGE_SIZE = 50;

// "Recent" threshold for relative-time rendering on the Queued column.
// Older rows fall back to absolute (via LocalTime) so users don't get
// "342d ago" — at that point an exact date is more useful.
const RELATIVE_MS = 24 * 60 * 60 * 1000;

type Props = {
  workspaceSlug: string;
  agentNames: string[];
  initial: LoadedRun[];
  /**
   * Initial filter values, typically read from the URL by the server
   * component so deep links (e.g. from a failed-run "find similar"
   * affordance) land prefiltered. Empty arrays / empty strings mean
   * "no filter."
   */
  initialFilters?: {
    statuses?: RunStatus[];
    triggers?: RunTrigger[];
    agentName?: string;
    search?: string;
  };
};

export function RunsList({
  workspaceSlug,
  agentNames,
  initial,
  initialFilters,
}: Props) {
  const router = useRouter();

  const [statuses, setStatuses] = useState<RunStatus[]>(
    initialFilters?.statuses ?? [],
  );
  const [triggers, setTriggers] = useState<RunTrigger[]>(
    initialFilters?.triggers ?? [],
  );
  const [agentName, setAgentName] = useState<string>(
    initialFilters?.agentName ?? "",
  );
  const [search, setSearch] = useState<string>(initialFilters?.search ?? "");

  const [rows, setRows] = useState<LoadedRun[]>(initial);
  const [more, setMore] = useState<boolean>(initial.length >= PAGE_SIZE);
  const [pending, startTransition] = useTransition();

  // Debounce the search input so we don't fire a network request per
  // keystroke. 250ms feels responsive without being chatty.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Track the latest filter combination so an in-flight fetch can
  // self-cancel by comparing its captured filters to current state.
  const filterEpoch = useRef(0);

  const filtersKey = JSON.stringify({
    statuses,
    triggers,
    agentName,
    search: debouncedSearch,
  });
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    filterEpoch.current += 1;
    const epoch = filterEpoch.current;
    startTransition(async () => {
      const next = await loadRunsAction({
        workspaceSlug,
        filters: {
          statuses: statuses.length ? statuses : undefined,
          triggers: triggers.length ? triggers : undefined,
          agentName: agentName || undefined,
          search: debouncedSearch || undefined,
        },
      });
      if (epoch !== filterEpoch.current) return; // stale
      setRows(next);
      setMore(next.length >= PAGE_SIZE);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, workspaceSlug]);

  const onLoadMore = useCallback(() => {
    if (rows.length === 0) return;
    const last = rows[rows.length - 1];
    startTransition(async () => {
      const next = await loadRunsAction({
        workspaceSlug,
        filters: {
          statuses: statuses.length ? statuses : undefined,
          triggers: triggers.length ? triggers : undefined,
          agentName: agentName || undefined,
          search: debouncedSearch || undefined,
        },
        beforeIso: last.createdAt,
      });
      setRows((prev) => [...prev, ...next]);
      setMore(next.length >= PAGE_SIZE);
    });
  }, [rows, workspaceSlug, statuses, triggers, agentName, debouncedSearch]);

  // Longest completed duration in the current row set — used to scale
  // the bar-chart background on the Duration cell. Memoised so a tall
  // re-sort of `rows` doesn't recompute on every cell render.
  const maxDurationMs = useMemo(() => {
    let max = 0;
    for (const r of rows) {
      if (r.startedAt && r.completedAt) {
        const d =
          new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime();
        if (d > max) max = d;
      }
    }
    return max;
  }, [rows]);

  // Same idea for cost — scale the Cost cell's background bar against
  // the highest cost in view. Runs without a recorded cost contribute
  // nothing (cost shows as "—").
  const maxCostUsd = useMemo(() => {
    let max = 0;
    for (const r of rows) {
      if (r.costUsd !== null && r.costUsd > max) max = r.costUsd;
    }
    return max;
  }, [rows]);

  // Stable agent options array (incl. "All agents" sentinel).
  const agentOptions = useMemo(
    () => [
      { value: "", label: "All agents" },
      ...agentNames.map((n) => ({ value: n, label: n })),
    ],
    [agentNames],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Filter row */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground-weak w-20 shrink-0 text-xs uppercase tracking-wide">
            Status
          </span>
          {ALL_STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={statuses.includes(s)}
              onClick={() => toggle(s, statuses, setStatuses)}
              label={STATUS_LABELS[s]}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground-weak w-20 shrink-0 text-xs uppercase tracking-wide">
            Trigger
          </span>
          {ALL_TRIGGERS.map((t) => (
            <FilterChip
              key={t}
              active={triggers.includes(t)}
              onClick={() => toggle(t, triggers, setTriggers)}
              label={TRIGGER_LABELS[t]}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground-weak w-20 shrink-0 text-xs uppercase tracking-wide">
            Agent
          </span>
          <Select
            value={agentName}
            onValueChange={setAgentName}
            options={agentOptions}
            ariaLabel="Filter by agent"
            className="min-w-[200px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="run-search"
            className="text-foreground-weak w-20 shrink-0 text-xs uppercase tracking-wide"
          >
            Search
          </label>
          <Input
            id="run-search"
            type="search"
            placeholder="Search input, output, or error…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
            maxLength={200}
          />
        </div>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {/* Result count + table */}
      <div className="text-foreground-weak text-sm">
        {pending
          ? "Loading…"
          : rows.length === 0
            ? "No runs match these filters."
            : `${rows.length} run${rows.length === 1 ? "" : "s"}${more ? "+" : ""}`}
      </div>

      {rows.length > 0 && (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-foreground-weak text-sm uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Agent</th>
                <th className="px-3 py-2 text-left font-medium">Trigger</th>
                <th className="px-3 py-2 text-left font-medium">Input</th>
                <th className="px-3 py-2 text-left font-medium">Queued</th>
                <th className="px-3 py-2 text-left font-medium">Duration</th>
                <th className="px-3 py-2 text-left font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-weak)]">
              {rows.map((r) => (
                <RunRow
                  key={r.id}
                  run={r}
                  workspaceSlug={workspaceSlug}
                  maxDurationMs={maxDurationMs}
                  maxCostUsd={maxCostUsd}
                  onNavigate={(href) => router.push(href)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {more && rows.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onLoadMore}
            disabled={pending}
          >
            {pending ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

function RunRow({
  run,
  workspaceSlug,
  maxDurationMs,
  maxCostUsd,
  onNavigate,
}: {
  run: LoadedRun;
  workspaceSlug: string;
  maxDurationMs: number;
  maxCostUsd: number;
  onNavigate: (href: string) => void;
}) {
  const agentHref = `/${workspaceSlug}/agents/${encodeURIComponent(run.agentName)}`;
  const runHref = `${agentHref}/runs/${run.id}`;
  const durationMs =
    run.startedAt && run.completedAt
      ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
      : null;
  return (
    <tr
      className="bg-surface-raised hover:bg-interactive-state-hover cursor-pointer"
      onClick={() => onNavigate(runHref)}
    >
      <td className="px-3 py-2 align-top">
        <Badge variant={STATUS_BADGE[run.status]} size="small">
          {STATUS_LABELS[run.status]}
        </Badge>
      </td>
      <td className="px-3 py-2 align-top">
        <Link
          href={agentHref}
          onClick={(e) => e.stopPropagation()}
          className="text-foreground hover:underline"
        >
          {run.agentName}
        </Link>
      </td>
      <td className="px-3 py-2 align-top">
        {run.trigger === "schedule" ? (
          <Badge variant="blue" size="small">
            Scheduled
          </Badge>
        ) : run.trigger === "event" ? (
          <Badge variant="purple" size="small">
            Event
          </Badge>
        ) : (
          <span className="text-foreground-weak text-sm">Manual</span>
        )}
      </td>
      <td className="text-foreground max-w-md px-3 py-2 align-top text-xs">
        {run.userMessagePreview ? (
          <div className="truncate">{run.userMessagePreview}</div>
        ) : !run.errorMessagePreview ? (
          <span className="text-foreground-muted">—</span>
        ) : null}
        {run.errorMessagePreview && (
          // Failed runs surface their error inline so a triager can
          // scan failures without clicking into each row. Two-line
          // clamp keeps the column from ballooning on verbose stacks.
          <div className="text-sentiment-negative mt-0.5 line-clamp-2 font-mono text-xs leading-4">
            {run.errorMessagePreview}
          </div>
        )}
      </td>
      <td className="text-foreground-weak px-3 py-2 align-top text-xs">
        <QueuedAt iso={run.createdAt} />
      </td>
      <td className="text-foreground-weak relative px-3 py-2 align-top text-xs">
        {durationMs !== null && maxDurationMs > 0 ? (
          <>
            <span
              aria-hidden
              className="bg-interactive-state-hover absolute inset-y-1 left-1 rounded-sm"
              style={{
                width: `calc(${Math.max(2, (durationMs / maxDurationMs) * 100)}% - 8px)`,
              }}
            />
            <span className="relative">{formatDuration(durationMs)}</span>
          </>
        ) : run.startedAt ? (
          <span>Running</span>
        ) : (
          <span className="text-foreground-muted">—</span>
        )}
      </td>
      <td className="text-foreground-weak relative px-3 py-2 align-top text-xs">
        {run.costUsd !== null && maxCostUsd > 0 ? (
          <>
            <span
              aria-hidden
              className="bg-interactive-state-hover absolute inset-y-1 left-1 rounded-sm"
              style={{
                width: `calc(${Math.max(2, (run.costUsd / maxCostUsd) * 100)}% - 8px)`,
              }}
            />
            <span className="relative">{formatCurrency(run.costUsd)}</span>
          </>
        ) : (
          <span className="text-foreground-muted">—</span>
        )}
      </td>
    </tr>
  );
}

// "5m ago" / "3h ago" within RELATIVE_MS, absolute LocalTime
// otherwise. Re-renders every minute via a tick state so a row
// queued 59s ago doesn't sit at "59s ago" forever.
function QueuedAt({ iso }: { iso: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < RELATIVE_MS) return <span>{formatRelativeAgo(ms)}</span>;
  return <LocalTime iso={iso} style="relative" />;
}

function formatRelativeAgo(diffMs: number): string {
  if (diffMs < 0) return "just now";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "bg-interactive text-foreground-on-accent border-interactive rounded-md border px-2.5 py-1 text-sm font-medium"
          : "text-foreground hover:bg-surface-raised border-border rounded-md border px-2.5 py-1 text-sm font-medium"
      }
    >
      {label}
    </button>
  );
}

function toggle<T>(value: T, list: T[], set: (next: T[]) => void) {
  set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
}

const STATUS_LABELS: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

const TRIGGER_LABELS: Record<RunTrigger, string> = {
  manual: "Manual",
  schedule: "Scheduled",
  event: "Event",
};

const STATUS_BADGE: Record<
  RunStatus,
  "green" | "red" | "yellow" | "blue" | "gray"
> = {
  queued: "yellow",
  running: "blue",
  succeeded: "green",
  failed: "red",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms - m * 60_000) / 1000);
  return `${m}m ${s}s`;
}
