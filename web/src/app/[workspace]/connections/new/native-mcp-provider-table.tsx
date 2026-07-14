"use client";

import { useMemo, useState } from "react";

import { McpProviderLogo } from "@/components/mcp-provider-logo";
import { DataTable, type Column, type SortDir } from "@/components/ui/data-table";

// Client-side searchable / filterable / sortable table for the Native MCP
// provider picker (Connections → New → Native MCP). Catalog is small, so
// all filtering happens in JS. Default sort is Name ascending.

export type NativeMcpProviderRow = {
  slug: string;
  displayName: string;
  /** Auth-mode label shown in the Auth column and used as the filter value. */
  authLabel: string;
  /** Work-area category (CRM, Helpdesk, …); empty when uncategorized. */
  categoryLabel: string;
  href: string;
};

type SortKey = "displayName" | "authLabel" | "categoryLabel";

export function NativeMcpProviderTable({
  rows,
}: {
  rows: NativeMcpProviderRow[];
}) {
  const [search, setSearch] = useState("");
  const [auth, setAuth] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("displayName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const authOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.authLabel))).sort(),
    [rows],
  );
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.categoryLabel).filter((c) => c.length > 0)),
      ).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (auth !== "all" && r.authLabel !== auth) return false;
      if (category !== "all" && r.categoryLabel !== category) return false;
      if (!needle) return true;
      return (
        r.displayName.toLowerCase().includes(needle) ||
        r.slug.toLowerCase().includes(needle) ||
        r.authLabel.toLowerCase().includes(needle) ||
        r.categoryLabel.toLowerCase().includes(needle)
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      const av = a[sortKey] || "\uffff"; // empty category sorts last
      const bv = b[sortKey] || "\uffff";
      const primary = av.localeCompare(bv) * dir;
      return primary !== 0 ? primary : a.displayName.localeCompare(b.displayName);
    });
  }, [rows, search, auth, category, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const columns: Column<NativeMcpProviderRow>[] = [
    {
      key: "displayName",
      header: "Provider",
      sortable: true,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <McpProviderLogo slug={r.slug} label={r.displayName} size={20} />
          <div className="flex min-w-0 flex-col">
            <span className="text-foreground font-medium">{r.displayName}</span>
            <code className="text-foreground-muted truncate text-xs">{r.slug}</code>
          </div>
        </div>
      ),
    },
    {
      key: "categoryLabel",
      header: "Category",
      sortable: true,
      thClassName: "w-[160px]",
      cell: (r) => (
        <span className="text-foreground-muted text-sm">
          {r.categoryLabel || "—"}
        </span>
      ),
    },
    {
      key: "authLabel",
      header: "Auth",
      sortable: true,
      thClassName: "w-[160px]",
      cell: (r) => (
        <span className="text-foreground-muted text-sm">{r.authLabel}</span>
      ),
    },
    {
      key: "connect",
      header: "",
      thClassName: "w-[90px]",
      tdClassName: "text-right",
      cell: () => (
        <span className="text-foreground-weak text-sm font-medium">
          Connect →
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <label
            htmlFor="native-mcp-search"
            className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
          >
            Search
          </label>
          <input
            id="native-mcp-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search providers…"
            className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
          />
        </div>
        {categoryOptions.length > 0 && (
          <div className="flex min-w-[150px] flex-col gap-1">
            <label
              htmlFor="native-mcp-category"
              className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
            >
              Category
            </label>
            <select
              id="native-mcp-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
            >
              <option value="all">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex min-w-[150px] flex-col gap-1">
          <label
            htmlFor="native-mcp-auth"
            className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
          >
            Auth
          </label>
          <select
            id="native-mcp-auth"
            value={auth}
            onChange={(e) => setAuth(e.target.value)}
            className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
          >
            <option value="all">All auth modes</option>
            {authOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <p className="text-foreground-muted pb-1.5 text-sm tabular-nums">
          {filtered.length} provider{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getRowKey={(r) => r.slug}
        rowHref={(r) => r.href}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key) => {
          if (key === "connect") return;
          toggleSort(key as SortKey);
        }}
        empty={
          <p className="text-foreground-weak text-base">
            No providers match the current filters.
          </p>
        }
      />
    </div>
  );
}
