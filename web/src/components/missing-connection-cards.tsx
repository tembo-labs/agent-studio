"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { IconExclamationTriangle } from "central-icons";

import { Button } from "@/components/ui/button";

// One "Action needed" missing-connection card per item, with a per-user
// dismiss. A user who doesn't intend to wire up a given connection can hide its
// nag; the choice persists in localStorage (no server round-trip, matches the
// sidebar-nav / docs-nav persistence pattern). Dismissals are keyed by the
// connection identity (source:toolkit:name), so a brand-new missing connection
// still shows.

export type MissingConnectionItem = {
  /** Stable identity = `${source}:${toolkit}:${name}` — also the dismiss key. */
  key: string;
  label: string;
  agentLabel: string;
  href: string;
  action: string;
};

const STORAGE_KEY = "tas-dismissed-connections";

function loadDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function MissingConnectionCards({
  items,
}: {
  items: MissingConnectionItem[];
}) {
  // Hydrate dismissals after mount (localStorage is client-only; reading it in
  // the initializer would mismatch SSR). `ready` gates the first paint so we
  // don't briefly flash a card the user already dismissed.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Hydrate from localStorage after mount (client-only).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(loadDismissed());
    setReady(true);
  }, []);

  function dismiss(key: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(key);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // ignore (private mode / storage disabled)
      }
      return next;
    });
  }

  if (!ready) return null;
  const visible = items.filter((it) => !dismissed.has(it.key));

  return (
    <>
      {visible.map((it) => (
        <div
          key={it.key}
          className="flex items-start gap-2 rounded-md bg-[var(--color-sentiment-caution-subtle)] px-2 py-2"
        >
          <IconExclamationTriangle
            size={14}
            className="mt-0.5 shrink-0 text-[var(--color-icon-sentiment-caution)]"
          />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
            <span className="text-sm leading-tight text-[var(--color-foreground-sentiment-caution)]">
              <span className="font-semibold">{it.label}</span> for{" "}
              <span className="font-semibold">{it.agentLabel}</span>
            </span>
            <div className="flex items-center gap-3">
              <Button asChild variant="orange" size="small">
                <Link href={it.href}>{it.action}</Link>
              </Button>
              <button
                type="button"
                onClick={() => dismiss(it.key)}
                className="text-foreground-muted hover:text-foreground-weak text-xs underline underline-offset-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
