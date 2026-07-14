"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { LocalTime } from "@/components/local-time";
import { McpProviderLogo } from "@/components/mcp-provider-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column, type SortDir } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import {
  bulkDeleteDismissedInboxItemsAction,
  bulkDismissInboxItemsAction,
} from "./actions";

// Search / filter / facet for the Tasks Inbox. The table chrome, row hover,
// whole-row click, and sortable headers all come from the shared DataTable.
// The same slicing is exposed to agents via list_inbox_items (MCP) + the
// GET /api/v1/inbox REST endpoint.

export type InboxRow = {
  id: string;
  title: string;
  source: string;
  itemType: string;
  status: "open" | "claimed" | "awaiting_human" | "done" | "dismissed";
  createdAtIso: string;
  snoozedUntilIso: string | null;
};

type StatusFacet =
  | "active"
  | "snoozed"
  | "awaiting_human"
  | "open"
  | "claimed"
  | "done"
  | "dismissed";

type SortKey = "title" | "source" | "item_type" | "status" | "created";

const ACTIVE_STATUSES: InboxRow["status"][] = [
  "open",
  "claimed",
  "awaiting_human",
];

/** Currently snoozed = snoozed_until is set to a future time. */
function isSnoozed(i: InboxRow): boolean {
  return !!i.snoozedUntilIso && new Date(i.snoozedUntilIso).getTime() > Date.now();
}

export function InboxList({
  items,
  workspaceSlug,
}: {
  items: InboxRow[];
  workspaceSlug: string;
}) {
  const [query, setQuery] = useState("");
  const [facet, setFacet] = useState<StatusFacet>("active");
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, startBulk] = useTransition();
  // Active facets mass-dismiss; Dismissed mass-deletes. Done stays
  // unselectable (keep history). Selection is disabled only on Done.
  const selectionEnabled = facet !== "done";
  const isDismissedFacet = facet === "dismissed";

  const counts = useMemo(() => {
    const c = {
      active: 0,
      snoozed: 0,
      awaiting_human: 0,
      open: 0,
      claimed: 0,
      done: 0,
      dismissed: 0,
    };
    for (const i of items) {
      // Snoozed items are counted only under "snoozed", out of active.
      if (isSnoozed(i)) {
        c.snoozed++;
        continue;
      }
      c[i.status]++;
      if (ACTIVE_STATUSES.includes(i.status)) c.active++;
    }
    return c;
  }, [items]);

  const sourceOptions = useMemo(() => {
    const set = new Set(items.map((i) => i.source));
    return [
      { value: "", label: "All sources" },
      ...[...set].sort().map((s) => ({ value: s, label: s })),
    ];
  }, [items]);
  const typeOptions = useMemo(() => {
    const set = new Set(items.map((i) => i.itemType));
    return [
      { value: "", label: "All types" },
      ...[...set].sort().map((t) => ({ value: t, label: t })),
    ];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = items.filter((i) => {
      if (facet === "snoozed") return isSnoozed(i);
      if (isSnoozed(i)) return false; // snoozed items hide from all other facets
      if (facet === "active") return ACTIVE_STATUSES.includes(i.status);
      return i.status === facet;
    });
    if (q) {
      rows = rows.filter((i) =>
        `${i.title} ${i.source} ${i.itemType}`.toLowerCase().includes(q),
      );
    }
    if (sourceFilter) rows = rows.filter((i) => i.source === sourceFilter);
    if (typeFilter) rows = rows.filter((i) => i.itemType === typeFilter);
    const sign = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case "created":
          return (
            (new Date(a.createdAtIso).getTime() -
              new Date(b.createdAtIso).getTime()) *
            sign
          );
        case "title":
          return a.title.localeCompare(b.title) * sign;
        case "source":
          return a.source.localeCompare(b.source) * sign;
        case "item_type":
          return a.itemType.localeCompare(b.itemType) * sign;
        case "status":
          return a.status.localeCompare(b.status) * sign;
      }
    });
  }, [items, query, facet, sourceFilter, typeFilter, sortKey, sortDir]);

  function onSort(key: string) {
    const k = key as SortKey;
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "created" ? "desc" : "asc");
    }
  }

  // Selection acts on the CURRENT view: derive the visible subset so switching
  // facet/filter/search naturally drops out-of-view selections (and never
  // dismisses a row the user can't see).
  const effectiveSelected = useMemo(() => {
    const visible = new Set(filtered.map((i) => i.id));
    return new Set([...selected].filter((id) => visible.has(id)));
  }, [selected, filtered]);
  const allSelected =
    filtered.length > 0 && filtered.every((i) => effectiveSelected.has(i.id));
  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((i) => i.id)));
  }
  function bulkDismiss() {
    const itemIds = [...effectiveSelected];
    if (itemIds.length === 0) return;
    startBulk(async () => {
      const r = await bulkDismissInboxItemsAction({ workspaceSlug, itemIds });
      if (r.ok) {
        toast.success(`Dismissed ${r.dismissed} item${r.dismissed === 1 ? "" : "s"}`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function bulkDelete() {
    const itemIds = [...effectiveSelected];
    if (itemIds.length === 0) return;
    startBulk(async () => {
      const r = await bulkDeleteDismissedInboxItemsAction({
        workspaceSlug,
        itemIds,
      });
      if (r.ok) {
        toast.success(`Deleted ${r.deleted} item${r.deleted === 1 ? "" : "s"}`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  const columns: Column<InboxRow>[] = [
    {
      key: "title",
      header: "Item",
      sortable: true,
      tdClassName: "max-w-md font-medium text-foreground",
      cell: (i) => <span className="line-clamp-2 leading-5">{i.title}</span>,
    },
    {
      key: "source",
      header: "Source",
      sortable: true,
      tdClassName: "text-foreground-weak text-sm",
      cell: (i) => <McpProviderLogo slug={i.source} label={i.source} size={20} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (i) => <StatusBadge status={i.status} />,
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      tdClassName: "text-foreground-weak text-sm",
      cell: (i) => <LocalTime iso={i.createdAtIso} style="relative" />,
    },
  ];

  const facets: Array<{ key: StatusFacet; label: string }> = [
    { key: "active", label: "Active" },
    { key: "awaiting_human", label: "Needs review" },
    { key: "open", label: "Open" },
    { key: "claimed", label: "Claimed" },
    { key: "snoozed", label: "Snoozed" },
    { key: "done", label: "Done" },
    { key: "dismissed", label: "Dismissed" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Search inbox…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
          aria-label="Search inbox"
        />
        {sourceOptions.length > 1 && (
          <Select
            value={sourceFilter}
            onValueChange={setSourceFilter}
            options={sourceOptions}
            ariaLabel="Filter by source"
            className="min-w-[130px]"
          />
        )}
        {typeOptions.length > 1 && (
          <Select
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={typeOptions}
            ariaLabel="Filter by type"
            className="min-w-[130px]"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {facets.map(({ key, label }) => {
          const count = counts[key];
          if (key !== "active" && count === 0) return null;
          const isActive = key === facet;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFacet(key)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors ${
                isActive
                  ? "border-foreground bg-surface-raised text-foreground"
                  : "border-border bg-surface text-foreground-weak hover:text-foreground"
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-sm font-medium ${
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

      {selectionEnabled && effectiveSelected.size > 0 && (
        <div className="bg-surface-raised border-border flex items-center gap-3 rounded-lg border px-3 py-2">
          <span className="text-foreground text-sm font-medium">
            {effectiveSelected.size} selected
          </span>
          {isDismissedFacet ? (
            <Button
              size="small"
              variant="destructive"
              disabled={bulkBusy}
              onClick={bulkDelete}
            >
              {bulkBusy ? "Deleting…" : "Delete"}
            </Button>
          ) : (
            <Button
              size="small"
              variant="destructive"
              disabled={bulkBusy}
              onClick={bulkDismiss}
            >
              {bulkBusy ? "Dismissing…" : "Dismiss"}
            </Button>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-foreground-weak hover:text-foreground text-sm"
          >
            Clear
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={filtered}
        getRowKey={(i) => i.id}
        rowHref={(i) => `/${workspaceSlug}/inbox/${i.id}`}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        selectedKeys={selectionEnabled ? effectiveSelected : undefined}
        onToggleRow={selectionEnabled ? toggleRow : undefined}
        allSelected={allSelected}
        onToggleAll={toggleAll}
        empty={
          <div className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm">
            No items match these filters.
          </div>
        }
      />
    </div>
  );
}

function StatusBadge({ status }: { status: InboxRow["status"] }) {
  switch (status) {
    case "open":
      return <Badge variant="gray" size="small">Open</Badge>;
    case "claimed":
      return <Badge variant="blue" size="small">Claimed</Badge>;
    case "awaiting_human":
      return <Badge variant="blue" size="small">Needs review</Badge>;
    case "done":
      return <Badge variant="green" size="small">Done</Badge>;
    case "dismissed":
      return <Badge variant="gray" size="small">Dismissed</Badge>;
  }
}
