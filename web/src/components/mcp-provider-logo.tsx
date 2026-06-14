"use client";

import { useState } from "react";

import { IconApiConnection } from "central-icons";

import { mcpLogoUrl } from "@/lib/mcp-logo";

// Provider logo for a native-MCP / Composio provider, resolved via
// mcpLogoUrl() (Composio CDN, or our local art for the providers Composio
// doesn't carry). Falls back to a generic connection glyph if the image is
// missing or blocked. Client component so the onError fallback works.
export function McpProviderLogo({
  slug,
  label,
  size = 20,
}: {
  slug: string;
  label?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      title={label}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded"
      style={{ width: size, height: size }}
    >
      {failed ? (
        <IconApiConnection
          size={Math.round(size * 0.7)}
          className="text-foreground-muted"
        />
      ) : (
        // Plain <img> (not next/image) — small third-party logo; broken/unknown
        // slugs swap to the fallback glyph.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mcpLogoUrl(slug)}
          alt=""
          aria-hidden
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
