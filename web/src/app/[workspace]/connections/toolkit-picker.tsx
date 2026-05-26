"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { type CatalogToolkit } from "@/lib/composio";

// Combobox-style picker for the Add Another Connection form.
//
// HTML <datalist> renders each suggestion stacked (value on top,
// option text below) with no styling control — fine for short
// curated lists, bad for ~300 toolkits where users want to scan
// name and slug side-by-side. This component takes the place of
// the datalist:
//
//   * Input that filters the list as you type (matches against
//     name + slug, case-insensitive substring).
//   * Scrollable popover showing matches, with the display name in
//     regular weight on the left and the slug in mono/muted on the
//     right.
//   * Click a row → input value is set to the slug, popover closes.
//   * Free-text entry still works — the input is the source of
//     truth; the picker is suggestion-only.
//
// Submits via a hidden input named `toolkit` so the surrounding
// <form action="GET /api/connections/..."> picks it up.

type Props = {
  /** Name attribute for the hidden input the parent form reads. */
  fieldName: string;
  /** Full Composio catalog from the server-side fetch, alphabetized. */
  catalog: CatalogToolkit[];
  /** Initial value if any (defaults to empty string). */
  defaultValue?: string;
};

export function ToolkitPicker({
  fieldName,
  catalog,
  defaultValue = "",
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return catalog.slice(0, 200); // cap so the DOM stays small
    return catalog
      .filter(
        (t) =>
          t.slug.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q),
      )
      .slice(0, 200);
  }, [catalog, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function pick(slug: string) {
    setValue(slug);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        required
        pattern="[a-z0-9_-]+"
        autoComplete="off"
        spellCheck={false}
        placeholder="gmail"
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setHighlightIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
            setOpen(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIndex((i) => Math.min(filtered.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIndex((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && filtered[highlightIndex]) {
            e.preventDefault();
            pick(filtered[highlightIndex].slug);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="bg-input border-border text-foreground w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
      />
      <input type="hidden" name={fieldName} value={value} />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="bg-surface-raised border-border absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border shadow-[0_8px_24px_0_rgba(0,0,0,0.12)]"
        >
          {filtered.map((t, i) => (
            <li
              key={t.slug}
              role="option"
              aria-selected={i === highlightIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(t.slug);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={
                i === highlightIndex
                  ? "bg-interactive-state-hover flex cursor-pointer items-center gap-2 px-2 py-1.5"
                  : "flex cursor-pointer items-center gap-2 px-2 py-1.5"
              }
            >
              {/* Logo from Composio's catalog. <img> instead of
                  next/image so we don't need to whitelist
                  logos.composio.dev in next.config — these are
                  small icons, optimization isn't critical. */}
              {t.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.logo}
                  alt=""
                  aria-hidden
                  className="bg-surface h-4 w-4 shrink-0 rounded-sm object-contain"
                />
              ) : (
                <span
                  aria-hidden
                  className="bg-surface h-4 w-4 shrink-0 rounded-sm"
                />
              )}
              <span className="text-foreground min-w-0 flex-1 truncate text-sm">
                {t.name}
              </span>
              <span className="text-foreground-muted shrink-0 font-mono text-xs">
                {t.slug}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
