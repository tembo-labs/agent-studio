"use client";

import { useState } from "react";

import { IconApiConnection } from "central-icons";

// Small provider logo shown next to a tool call in the step view. Borrows the
// same Composio logo CDN the agent-page connection icons use (provider slugs
// like "attio", "linear", "slack" all resolve there); falls back to a generic
// connection glyph for unknown/broken slugs.
export function ToolProviderLogo({
  providerSlug,
  title,
}: {
  providerSlug: string;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      title={title}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden"
    >
      {failed ? (
        <IconApiConnection size={12} className="text-foreground-muted" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://logos.composio.dev/api/${encodeURIComponent(providerSlug.toLowerCase())}`}
          alt=""
          aria-hidden
          className="h-4 w-4 object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
