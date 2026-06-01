"use client";

import { useState } from "react";

// Small Copy-to-clipboard affordance for tool slugs in the Tools
// tab. Authoring an agent's `tools: [...]` list means transcribing
// slugs verbatim — Attio uses kebab-case, Composio uses
// UPPER_SNAKE_CASE — and a single-char typo silently routes the
// model into a hidden tool. Click-to-copy removes the transcription
// step entirely.
//
// Renders the slug as `<code>` (same visual weight as the prior
// plain-code version) plus a tiny inline copy icon. On click: copies
// to clipboard, shows a "✓" for ~1.2s, then reverts. Fails open if
// `navigator.clipboard` is unavailable (insecure context); the
// button just becomes a no-op rather than throwing.

export function CopyableSlug({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // No clipboard API → no-op. User can still select + copy
      // manually; the affordance is a convenience, not a load-bearer.
    }
  }

  return (
    <span className="inline-flex items-baseline gap-1">
      <code
        className={
          className ?? "text-foreground text-sm font-medium"
        }
      >
        {slug}
      </code>
      <button
        type="button"
        onClick={onCopy}
        title={copied ? "Copied!" : "Copy slug"}
        aria-label={copied ? "Copied" : "Copy slug to clipboard"}
        className="text-foreground-muted hover:text-foreground inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[14px] opacity-50 transition-opacity hover:opacity-100"
      >
        {copied ? "✓" : "⧉"}
      </button>
    </span>
  );
}
