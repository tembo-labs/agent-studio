"use client";

import { useState } from "react";

import { IconApiConnection } from "central-icons";

import { mcpLogoUrl } from "@/lib/mcp-logo";

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
  const slotSuffix =
    item.name && item.name !== "default" ? ` (${item.name})` : "";

  return (
    <span className="bg-surface-raised border-border inline-flex shrink-0 items-center gap-1.5 rounded-md border py-0.5 pl-1 pr-2">
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden">
        {failed ? (
          <IconApiConnection size={13} className="text-foreground-muted" />
        ) : (
          // Plain <img> (skip next/image host config) — small icon from
          // Composio's logo CDN; broken/unknown slugs swap to the fallback.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mcpLogoUrl(item.slug)}
            alt=""
            aria-hidden
            className="h-4 w-4 object-contain"
            onError={() => setFailed(true)}
          />
        )}
      </span>
      <span className="text-foreground-weak text-xs">
        {item.label}
        {slotSuffix}
      </span>
    </span>
  );
}
