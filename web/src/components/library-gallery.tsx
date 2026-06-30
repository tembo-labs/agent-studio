"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CATEGORY_META, type Ranked } from "@/lib/connection-categories";
import type { LibraryAgent } from "@/lib/agent-library/types";

// Browsable gallery of starter agents, ranked so the ones the user can run now
// (given their connections) lead. Facets: work area, label, connection, plus a
// search box and a "ready only" toggle. Clicking a card deep-links to the New
// Agent form pre-filled with the starter's prompt (?starter=<id>).

type Item = Ranked<LibraryAgent>;

export function LibraryGallery({
  items,
  workspaceSlug,
}: {
  items: Item[];
  workspaceSlug: string;
}) {
  const [query, setQuery] = useState("");
  const [workArea, setWorkArea] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [readyOnly, setReadyOnly] = useState(false);

  const workAreaOptions = useMemo(
    () => [
      { value: "", label: "All work areas" },
      ...[...new Set(items.map((i) => i.agent.workArea))].sort().map((w) => ({ value: w, label: w })),
    ],
    [items],
  );
  const labelOptions = useMemo(
    () => [
      { value: "", label: "All labels" },
      ...[...new Set(items.flatMap((i) => i.agent.labels))].sort().map((l) => ({ value: l, label: l })),
    ],
    [items],
  );
  const categoryOptions = useMemo(
    () => [
      { value: "", label: "All connections" },
      ...[...new Set(items.flatMap((i) => i.agent.categories))]
        .map((c) => ({ value: c, label: CATEGORY_META[c].label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      const a = i.agent;
      if (workArea && a.workArea !== workArea) return false;
      if (label && !a.labels.includes(label)) return false;
      if (category && !a.categories.includes(category as LibraryAgent["categories"][number])) return false;
      if (readyOnly && !i.ready) return false;
      if (q && !`${a.title} ${a.task} ${a.workArea} ${a.labels.join(" ")}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [items, query, workArea, label, category, readyOnly]);

  const readyCount = filtered.filter((i) => i.ready).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          placeholder="Search agents…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
          aria-label="Search the agent library"
        />
        <Select value={workArea} onValueChange={setWorkArea} options={workAreaOptions} ariaLabel="Filter by work area" className="min-w-[150px]" />
        <Select value={label} onValueChange={setLabel} options={labelOptions} ariaLabel="Filter by label" className="min-w-[130px]" />
        <Select value={category} onValueChange={setCategory} options={categoryOptions} ariaLabel="Filter by connection" className="min-w-[150px]" />
        <label className="text-foreground-weak flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={readyOnly}
            onChange={(e) => setReadyOnly(e.target.checked)}
            className="h-4 w-4"
          />
          Ready for my connections
        </label>
        <span className="text-foreground-weak ml-auto text-sm">
          {filtered.length} agent{filtered.length === 1 ? "" : "s"} · {readyCount} ready
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm">
          No agents match these filters.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => (
            <StarterCard key={i.agent.id} item={i} workspaceSlug={workspaceSlug} />
          ))}
        </div>
      )}
    </div>
  );
}

function StarterCard({ item, workspaceSlug }: { item: Item; workspaceSlug: string }) {
  const { agent, ready, categoryStatuses } = item;
  return (
    <div className="border-border bg-surface-secondary flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-foreground font-medium leading-tight">{agent.title}</span>
        {ready && (
          <Badge variant="green" size="small">
            Ready
          </Badge>
        )}
      </div>

      <p className="text-foreground-weak flex-1 text-sm leading-snug">{agent.task}</p>

      {/* Connection chips: satisfied (plain), needs-connect (link), or not-yet. */}
      {categoryStatuses.some((c) => !c.builtin) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryStatuses
            .filter((c) => !c.builtin)
            .map((c) =>
              c.satisfied ? (
                <Badge key={c.category} variant="green" size="small">
                  {c.label}
                </Badge>
              ) : c.supported ? (
                <Link
                  key={c.category}
                  href={`/${workspaceSlug}/connections`}
                  className="text-[var(--color-foreground-sentiment-caution)] hover:underline"
                >
                  <Badge variant="yellow" size="small">
                    Connect {c.label}
                  </Badge>
                </Link>
              ) : (
                <Badge key={c.category} variant="gray" size="small">
                  {c.label} (not yet)
                </Badge>
              ),
            )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="gray" size="small">
            {agent.workArea}
          </Badge>
          {agent.labels.map((l) => (
            <Badge key={l} variant="gray" size="small">
              {l}
            </Badge>
          ))}
        </div>
        <Button asChild size="small" variant="secondary">
          <Link href={`/${workspaceSlug}/agents/new?starter=${encodeURIComponent(agent.id)}`}>
            Use this
          </Link>
        </Button>
      </div>
    </div>
  );
}
