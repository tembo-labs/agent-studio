"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { McpProviderLogo } from "@/components/mcp-provider-logo";
import { Badge } from "@/components/ui/badge";

import type { ConnectionRow } from "./connection-ref";

// Client-side searchable/filterable/sortable table for the Connections index,
// modeled on the Tools tab. Row counts are small (a member's connections +
// workspace secrets), so all of it happens in JS. Default sort is Name ascending
// (alphabetical).

type SortKey = "title" | "typeLabel" | "statusLabel";
type SortDir = "asc" | "desc";

export function ConnectionsTable({
  workspaceSlug,
  rows,
  viewUserId,
}: {
  workspaceSlug: string;
  rows: ConnectionRow[];
  viewUserId?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const typeOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.typeLabel))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (type !== "all" && r.typeLabel !== type) return false;
      if (!needle) return true;
      return (
        r.title.toLowerCase().includes(needle) ||
        (r.slot?.toLowerCase().includes(needle) ?? false) ||
        r.typeLabel.toLowerCase().includes(needle)
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      const primary = a[sortKey].localeCompare(b[sortKey]) * dir;
      // Stable secondary sort by title so equal keys keep a predictable order.
      return primary !== 0 ? primary : a.title.localeCompare(b.title);
    });
  }, [rows, search, type, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function href(r: ConnectionRow): string {
    return `/${workspaceSlug}/connections/${r.ref}${
      viewUserId ? `?user=${encodeURIComponent(viewUserId)}` : ""
    }`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          <label
            htmlFor="conn-search"
            className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
          >
            Search
          </label>
          <input
            id="conn-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="name, slot, or type"
            className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
          />
        </div>
        <div className="flex min-w-[160px] flex-col gap-1">
          <label
            htmlFor="conn-type"
            className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
          >
            Type
          </label>
          <select
            id="conn-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
          >
            <option value="all">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-foreground-weak text-base">
          No connections match the current filters.
        </p>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full border-collapse text-base">
            <thead className="bg-surface-secondary text-foreground-weak text-sm uppercase tracking-wide">
              <tr>
                <SortHeader
                  label="Name"
                  active={sortKey === "title"}
                  dir={sortDir}
                  onClick={() => toggleSort("title")}
                />
                <SortHeader
                  label="Type"
                  active={sortKey === "typeLabel"}
                  dir={sortDir}
                  onClick={() => toggleSort("typeLabel")}
                  className="w-[160px]"
                />
                <SortHeader
                  label="Status"
                  active={sortKey === "statusLabel"}
                  dir={sortDir}
                  onClick={() => toggleSort("statusLabel")}
                  className="w-[120px]"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-weak)]">
              {filtered.map((r) => (
                <tr
                  key={r.ref}
                  onClick={() => router.push(href(r))}
                  className="hover:bg-surface cursor-pointer"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {r.logoSlug ? (
                        <McpProviderLogo
                          slug={r.logoSlug}
                          label={r.title}
                          size={20}
                        />
                      ) : (
                        <span
                          className="bg-surface-secondary text-foreground-muted inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs"
                          aria-hidden
                        >
                          ⚿
                        </span>
                      )}
                      <span className="text-foreground font-medium">
                        {r.title}
                      </span>
                      {r.slot && (
                        <span className="text-foreground-muted truncate text-sm">
                          · {r.slot}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-foreground-muted px-3 py-2.5 text-sm">
                    {r.typeLabel}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={r.statusVariant} size="small">
                      {r.statusLabel}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortHeader({
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
        className="hover:text-foreground inline-flex items-center gap-1"
      >
        <span>{label}</span>
        <span aria-hidden className="text-xs">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
