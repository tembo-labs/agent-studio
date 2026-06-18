"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { toolkitLabel } from "@/lib/composio-label";
import type { McpTool } from "@/lib/mcp-tools";

import { CopyableSlug } from "./copyable-slug";

// Client-side filtered table for the workspace Tools tab. Data
// volume is bounded per-user (a handful of connections × ~10-20
// tools each = low hundreds at most), so all filtering happens in
// JS without round-tripping to the server. Search matches against
// tool slug, display name, and description; the two dropdown
// filters narrow by source and provider.

type Props = {
  workspaceSlug: string;
  tools: McpTool[];
  /** Initial filter state, normally read from URL search params on
   *  the server page. Lets a deep link from a Connections row land
   *  with the table already narrowed to that one connection's
   *  tools. */
  initialSearch?: string;
  initialSource?: SourceFilter;
  initialProvider?: string;
  initialConnection?: string;
};

type SourceFilter = "all" | McpTool["source"];

export function ToolsTable({
  workspaceSlug,
  tools,
  initialSearch = "",
  initialSource = "all",
  initialProvider = "all",
  initialConnection = "all",
}: Props) {
  const [search, setSearch] = useState(initialSearch);
  const [source, setSource] = useState<SourceFilter>(initialSource);
  const [provider, setProvider] = useState<string>(initialProvider);
  const [connection, setConnection] = useState<string>(initialConnection);

  // Provider options derived from the data so the dropdown only
  // shows providers the user actually has connections for. The
  // current source filter narrows the list — switching source from
  // "all" → "composio" prunes attio etc. so the provider dropdown
  // never offers an empty filter.
  const providerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of tools) {
      if (source !== "all" && t.source !== source) continue;
      set.add(t.provider);
    }
    return Array.from(set).sort();
  }, [tools, source]);

  // Drop the provider filter if it's no longer in the option list
  // (e.g. user picked "attio" then switched source to "composio").
  const effectiveProvider =
    provider === "all" || providerOptions.includes(provider) ? provider : "all";

  // Connection-name options are scoped to the currently selected
  // source + provider so a user with work + personal Attio sees both
  // names; if they switch provider to slack, the list reflects slack's
  // slot names instead.
  const connectionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of tools) {
      if (source !== "all" && t.source !== source) continue;
      if (effectiveProvider !== "all" && t.provider !== effectiveProvider)
        continue;
      set.add(t.connectionName);
    }
    return Array.from(set).sort();
  }, [tools, source, effectiveProvider]);
  const effectiveConnection =
    connection === "all" || connectionOptions.includes(connection)
      ? connection
      : "all";

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tools.filter((t) => {
      if (source !== "all" && t.source !== source) return false;
      if (effectiveProvider !== "all" && t.provider !== effectiveProvider)
        return false;
      if (
        effectiveConnection !== "all" &&
        t.connectionName !== effectiveConnection
      )
        return false;
      if (!needle) return true;
      // Substring against the user-visible fields. We don't bother
      // with fuzzy match yet — at low-hundreds row counts, plain
      // substring is fine and the lack of false positives keeps the
      // table predictable.
      return (
        t.slug.toLowerCase().includes(needle) ||
        (t.displayName?.toLowerCase().includes(needle) ?? false) ||
        (t.description?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [tools, search, source, effectiveProvider, effectiveConnection]);

  const totalCount = tools.length;
  const visibleCount = filtered.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          <label
            htmlFor="tools-search"
            className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
          >
            Search
          </label>
          <input
            id="tools-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="slug, name, or description"
            className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
          />
        </div>
        <div className="flex min-w-[140px] flex-col gap-1">
          <label
            htmlFor="tools-source"
            className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
          >
            Source
          </label>
          <select
            id="tools-source"
            value={source}
            onChange={(e) => setSource(e.target.value as SourceFilter)}
            className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
          >
            <option value="all">All sources</option>
            <option value="composio">Composio</option>
            <option value="native-mcp">Native MCP</option>
          </select>
        </div>
        <div className="flex min-w-[160px] flex-col gap-1">
          <label
            htmlFor="tools-provider"
            className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
          >
            Provider
          </label>
          <select
            id="tools-provider"
            value={effectiveProvider}
            onChange={(e) => setProvider(e.target.value)}
            className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
          >
            <option value="all">All providers</option>
            {providerOptions.map((p) => (
              <option key={p} value={p}>
                {providerDisplayLabel(p, tools, source)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[140px] flex-col gap-1">
          <label
            htmlFor="tools-connection"
            className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
          >
            Connection
          </label>
          <select
            id="tools-connection"
            value={effectiveConnection}
            onChange={(e) => setConnection(e.target.value)}
            className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
          >
            <option value="all">All connections</option>
            {connectionOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-foreground-weak text-base">
        Showing{" "}
        <span className="text-foreground font-medium">{visibleCount}</span> of{" "}
        <span className="text-foreground font-medium">{totalCount}</span>{" "}
        tool{totalCount === 1 ? "" : "s"}.
      </div>

      <DataTable<McpTool>
        columns={columns()}
        rows={filtered}
        getRowKey={(t) => t.id}
        rowHref={(t) => `/${workspaceSlug}/tools/${encodeURIComponent(t.id)}`}
        empty={
          <p className="text-foreground-weak text-base">
            {totalCount === 0 ? (
              <>
                No tools cached yet. Head to{" "}
                <Link
                  href={`/${workspaceSlug}/connections`}
                  className="text-foreground underline underline-offset-2"
                >
                  Connections
                </Link>{" "}
                to wire up a provider and prime the cache.
              </>
            ) : (
              "No tools match the current filters."
            )}
          </p>
        }
      />
    </div>
  );
}

function columns(): Column<McpTool>[] {
  return [
    {
      key: "tool",
      header: "Tool",
      thClassName: "w-[220px]",
      cell: (t) => (
        <>
          <CopyableSlug
            slug={t.slug}
            className="text-foreground break-all text-sm font-medium"
          />
          {t.displayName && t.displayName !== t.slug && (
            <div className="text-foreground-weak mt-0.5 text-sm">
              {t.displayName}
            </div>
          )}
        </>
      ),
    },
    {
      key: "description",
      header: "Description",
      tdClassName: "text-foreground-weak text-sm leading-snug",
      cell: (t) => t.description ?? "—",
    },
    {
      key: "source",
      header: "Source",
      thClassName: "w-[100px]",
      tdClassName: "whitespace-nowrap",
      cell: (t) => (
        <Badge variant={t.source === "composio" ? "blue" : "gray"} size="small">
          {t.source === "composio" ? "Composio" : "Native MCP"}
        </Badge>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      thClassName: "w-[120px]",
      tdClassName: "text-foreground text-sm",
      cell: (t) =>
        t.source === "composio" ? toolkitLabel(t.provider) : t.provider,
    },
    {
      key: "connection",
      header: "Connection",
      thClassName: "w-[110px]",
      tdClassName: "text-foreground-muted text-sm",
      cell: (t) => <code>{t.connectionName}</code>,
    },
  ];
}

function providerDisplayLabel(
  slug: string,
  tools: McpTool[],
  source: SourceFilter,
): string {
  // We use the same label the table uses so the dropdown stays in
  // sync. Composio gets a friendly label; native-MCP providers stay
  // as their lowercase slug. When source="all" we have to peek at
  // the data to figure out which source this provider sits under.
  if (source === "composio") return toolkitLabel(slug);
  if (source === "native-mcp") return slug;
  const example = tools.find((t) => t.provider === slug);
  return example?.source === "composio" ? toolkitLabel(slug) : slug;
}
