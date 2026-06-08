"use client";

import { useState } from "react";

import { IconApiConnection } from "central-icons";

// A compact row of the external services an agent uses, shown near the top of
// the agent detail page. Every icon — Composio, Native MCP, or a Secret —
// borrows its logo from Composio's public logo library
// (https://logos.composio.dev/api/<slug>); the native/secret slugs (attio,
// pylon, clay, …) are Composio toolkit slugs too, so they resolve from the same
// place. A slug with no logo falls back to a generic connection icon.

export type ConnectionIconItem = {
  slug: string;
  /** "default" or a named slot like "work". */
  name: string;
  /** Human label for the tooltip (e.g. "Attio", "Slack"). */
  label: string;
  source: "composio" | "native-mcp" | "secret";
};

export function AgentConnectionIcons({
  connections,
}: {
  connections: ConnectionIconItem[];
}) {
  if (connections.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-foreground-muted mr-0.5 text-xs uppercase tracking-wide">
        Uses
      </span>
      {connections.map((c) => (
        <ConnectionIcon key={`${c.source}:${c.slug}`} item={c} />
      ))}
    </div>
  );
}

function ConnectionIcon({ item }: { item: ConnectionIconItem }) {
  const [failed, setFailed] = useState(false);
  const label =
    item.name && item.name !== "default"
      ? `${item.label} (${item.name})`
      : item.label;

  return (
    <span
      title={label}
      className="bg-surface-raised border-border inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border"
    >
      {failed ? (
        <IconApiConnection size={14} className="text-foreground-muted" />
      ) : (
        // Plain <img> (skip next/image host config) — small icon from
        // Composio's logo CDN; broken/unknown slugs swap to the fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://logos.composio.dev/api/${encodeURIComponent(item.slug.toLowerCase())}`}
          alt={label}
          className="h-4 w-4 object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
