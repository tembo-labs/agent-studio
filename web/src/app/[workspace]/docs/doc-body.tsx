"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { DOC_SLUGS } from "./nav";

// Renders a doc page's markdown with our typography theme. Internal manual
// links (Starlight emits `/agent-studio/<slug>/`) are rewritten to the in-app
// docs route so navigation stays inside the app; external links open in a new
// tab; same-page anchors pass through.

export function DocBody({
  body,
  workspaceSlug,
}: {
  body: string;
  workspaceSlug: string;
}) {
  const base = `/${workspaceSlug}/docs`;
  return (
    <div className="prose dark:prose-invert max-w-none prose-pre:bg-surface prose-pre:border prose-pre:border-[var(--color-border)] prose-pre:text-foreground prose-code:bg-surface prose-code:text-foreground prose-code:font-mono prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-headings:text-foreground-title prose-strong:text-foreground prose-p:text-foreground prose-li:text-foreground prose-a:text-foreground prose-a:underline hover:prose-a:no-underline">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const h = href ?? "";
            if (h.startsWith("http")) {
              return (
                <a href={h} target="_blank" rel="noreferrer noopener">
                  {children}
                </a>
              );
            }
            const docHref = toDocHref(h, base);
            if (docHref) return <Link href={docHref}>{children}</Link>;
            return <a href={h}>{children}</a>;
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

// Map a manual link to the in-app docs route, or null if it isn't one.
// Matches `/agent-studio/<slug>/`, `/<slug>/`, with an optional `#anchor`.
function toDocHref(href: string, base: string): string | null {
  if (!href.startsWith("/")) return null;
  const m = href.match(/^\/(?:agent-studio\/)?([a-z0-9-]+)\/?(#.*)?$/);
  if (m && DOC_SLUGS.has(m[1])) return `${base}/${m[1]}${m[2] ?? ""}`;
  return null;
}
