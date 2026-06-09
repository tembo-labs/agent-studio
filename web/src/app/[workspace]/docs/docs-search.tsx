"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { IconMagnifyingGlass } from "central-icons";

export type DocSearchEntry = {
  slug: string;
  title: string;
  description: string;
  text: string;
};

// Client-side docs search over a lightweight index (title + description + a
// plaintext slice of each page). Lives top-right of the docs header. Results
// drop down with a snippet and link into the page.
export function DocsSearch({
  workspaceSlug,
  index,
}: {
  workspaceSlug: string;
  index: DocSearchEntry[];
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    const scored: { e: DocSearchEntry; score: number; snippet: string }[] = [];
    for (const e of index) {
      const t = e.title.toLowerCase();
      const d = e.description.toLowerCase();
      const b = e.text.toLowerCase();
      let score = 0;
      if (t.includes(query)) score += 3;
      if (d.includes(query)) score += 2;
      if (b.includes(query)) score += 1;
      if (score > 0) scored.push({ e, score, snippet: snippet(e, query) });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [q, index]);

  return (
    <div ref={ref} className="relative w-full sm:w-72">
      <div className="relative">
        <span className="text-foreground-muted pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
          <IconMagnifyingGlass size={14} />
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search docs…"
          aria-label="Search documentation"
          className="bg-input border-border text-foreground focus:ring-[var(--focus-ring-color,#009eff)] w-full rounded-lg border py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2"
        />
      </div>

      {open && q.trim().length >= 2 && (
        <div className="bg-surface-raised border-border absolute right-0 z-30 mt-1 w-full min-w-[18rem] overflow-hidden rounded-lg border shadow-[0_8px_24px_0_rgba(0,0,0,0.12)]">
          {results.length === 0 ? (
            <p className="text-foreground-weak px-3 py-3 text-sm">
              No matches for “{q.trim()}”.
            </p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto py-1">
              {results.map((r) => (
                <li key={r.e.slug}>
                  <Link
                    href={`/${workspaceSlug}/docs/${r.e.slug}`}
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                    }}
                    className="hover:bg-interactive-state-hover flex flex-col gap-0.5 px-3 py-2"
                  >
                    <span className="text-foreground text-sm font-medium">
                      {r.e.title}
                    </span>
                    {r.snippet && (
                      <span className="text-foreground-weak line-clamp-1 text-xs">
                        {r.snippet}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function snippet(e: DocSearchEntry, query: string): string {
  const hay = e.text;
  const i = hay.toLowerCase().indexOf(query);
  if (i < 0) return e.description;
  const start = Math.max(0, i - 40);
  const end = Math.min(hay.length, i + query.length + 60);
  return `${start > 0 ? "…" : ""}${hay.slice(start, end).trim()}${end < hay.length ? "…" : ""}`;
}
