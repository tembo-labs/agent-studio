"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// The one table primitive every list view uses, so chrome (border, header,
// row dividers), the visible row hover, whole-row click/navigation, sortable
// headers, and optional expandable detail rows all stay consistent.
//
// Sorting is CONTROLLED: the parent owns the sorted `rows` + (sortKey, sortDir)
// and gets onSort(key) callbacks. That keeps custom comparators (multi-key
// tiebreakers, nulls-last, etc.) in the parent while this component just draws
// the header affordance.
//
// Note: this is a client component. Because column `cell` renderers are
// functions, a SERVER page can't render it directly — wrap it in a small
// "use client" table component that receives plain-data rows (see InboxList /
// ImprovementsTableClient for the pattern).

export type SortDir = "asc" | "desc";

export type Column<T> = {
  /** Stable key; also the value passed to onSort when this column is sortable. */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
  /** Extra classes for the <th> (e.g. width: "w-[120px]"). */
  thClassName?: string;
  /** Extra classes for the <td>. */
  tdClassName?: string;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Whole-row navigation. Return a href to make the row a link target. */
  rowHref?: (row: T) => string | null | undefined;
  /** Whole-row click handler (alternative to rowHref). */
  onRowClick?: (row: T) => void;
  /** Optional detail rendered in an expandable sub-row; clicking the row toggles
   *  it (when neither rowHref nor onRowClick is set). */
  renderExpanded?: (row: T) => ReactNode;
  sortKey?: string;
  sortDir?: SortDir;
  onSort?: (key: string) => void;
  /** Per-row extra classes (e.g. an error tint). */
  rowClassName?: (row: T) => string;
  /** Shown in place of the table body when there are no rows. */
  empty?: ReactNode;
  // ── Row selection (opt-in: pass both selectedKeys + onToggleRow) ──
  /** The currently-selected row keys. Presence enables a leading checkbox
   *  column. Selection state is owned by the caller. */
  selectedKeys?: Set<string>;
  /** Toggle one row's selection. The checkbox stops click propagation so it
   *  never triggers rowHref/onRowClick navigation. */
  onToggleRow?: (key: string) => void;
  /** Whether every current row is selected (drives the header checkbox). */
  allSelected?: boolean;
  /** Toggle select-all / clear-all over the current rows. */
  onToggleAll?: () => void;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  rowHref,
  onRowClick,
  renderExpanded,
  sortKey,
  sortDir = "desc",
  onSort,
  rowClassName,
  empty,
  selectedKeys,
  onToggleRow,
  allSelected = false,
  onToggleAll,
}: DataTableProps<T>) {
  const selectable = !!selectedKeys && !!onToggleRow;
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (rows.length === 0 && empty !== undefined) {
    return <>{empty}</>;
  }

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-surface-secondary text-foreground-weak text-sm uppercase tracking-wide">
          <tr>
            {selectable && (
              <th className="w-9 p-0">
                {/* Pad the whole cell as the click target so a near-miss toggles
                    the box instead of doing nothing. */}
                <label className="flex cursor-pointer items-center justify-center px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={allSelected}
                    onChange={() => onToggleAll?.()}
                    className="cursor-pointer align-middle"
                  />
                </label>
              </th>
            )}
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              const align = col.align === "right" ? "text-right" : "text-left";
              return (
                <th
                  key={col.key}
                  className={cn("px-3 py-2 font-medium", align, col.thClassName)}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 uppercase tracking-wide",
                        isSorted
                          ? "text-foreground"
                          : "text-foreground-weak hover:text-foreground",
                      )}
                    >
                      {col.header}
                      <span className="text-sm" aria-hidden>
                        {isSorted ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-weak)]">
          {rows.map((row) => {
            const key = getRowKey(row);
            const href = rowHref?.(row) ?? null;
            const canExpand = !href && !onRowClick && !!renderExpanded;
            const clickable = !!href || !!onRowClick || canExpand;

            const handleClick = (e: React.MouseEvent) => {
              // Don't hijack clicks on inner links/buttons.
              if ((e.target as HTMLElement).closest("a, button")) return;
              if (href) router.push(href);
              else if (onRowClick) onRowClick(row);
              else if (canExpand) toggleExpanded(key);
            };

            return (
              <Fragment key={key}>
                <tr
                  onClick={clickable ? handleClick : undefined}
                  className={cn(
                    "bg-surface-raised hover:bg-interactive-state-hover transition-colors",
                    clickable && "cursor-pointer",
                    rowClassName?.(row),
                  )}
                >
                  {selectable && (
                    <td className="w-9 p-0 align-top">
                      {/* The label fills the cell's padding so a click anywhere
                          near the box toggles it; stopping propagation keeps that
                          click from triggering the row's navigation. */}
                      <label
                        className="flex cursor-pointer items-center px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={selectedKeys!.has(key)}
                          onChange={() => onToggleRow!(key)}
                          className="cursor-pointer align-middle"
                        />
                      </label>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-3 py-2 align-top",
                        col.align === "right" && "text-right",
                        col.tdClassName,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
                {canExpand && expanded.has(key) && (
                  <tr className="bg-surface-raised">
                    <td
                      colSpan={columns.length + (selectable ? 1 : 0)}
                      className="px-3 pb-3"
                    >
                      {renderExpanded!(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
