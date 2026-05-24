// Lightweight markdown renderer used for agent output. Wraps
// react-markdown with our typography styling so headings, lists,
// code, links, tables and strikethrough render with our theme.
// Plain-text content degrades gracefully — react-markdown leaves
// non-markdown strings as ordinary paragraphs.
//
// Keep the plugin set narrow on purpose: GFM gives us tables and
// autolinks; we explicitly don't enable raw HTML for safety.

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type Props = {
  children: string;
  className?: string;
};

export function Markdown({ children, className }: Props) {
  return (
    <div
      className={cn(
        // Tailwind Typography handles most of the rendering. `prose-sm`
        // matches the surrounding "small body copy" we use elsewhere
        // for inline content; `max-w-none` lets it stretch to the
        // container.
        "prose prose-sm dark:prose-invert max-w-none",
        // Strip Typography's default margins around code blocks so
        // they sit flush like our existing <pre> blocks. Inline code
        // gets a subtle surface tint for legibility.
        "prose-pre:bg-surface prose-pre:border prose-pre:border-[var(--color-border)] prose-pre:text-foreground",
        "prose-code:bg-surface prose-code:text-foreground prose-code:font-mono prose-code:rounded prose-code:px-1 prose-code:py-0.5",
        "prose-headings:text-foreground-title prose-strong:text-foreground prose-p:text-foreground prose-li:text-foreground",
        "prose-a:text-foreground prose-a:underline hover:prose-a:no-underline",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
