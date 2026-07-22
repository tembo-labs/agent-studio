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
  size?: "sm" | "lg";
};

// `sm` matches the surrounding "small body copy" we use for inline content.
// `lg` is for long-form reading (inbox digests) where the text IS the page
// rather than a field inside it: 18px body on a 1.6 line-height (a notch
// under the tembo.io blog's 19px, which reads oversized inside app chrome).
const SIZE_CLASSES = {
  sm: "prose-sm",
  lg: "prose-lg leading-[1.6] prose-headings:font-semibold",
};

export function Markdown({ children, className, size = "sm" }: Props) {
  return (
    <div
      className={cn(
        // Tailwind Typography handles most of the rendering; `max-w-none`
        // lets it stretch to the container.
        "prose dark:prose-invert max-w-none",
        SIZE_CLASSES[size],
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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Register-style agents emit tables with 10+ columns; scroll them
          // horizontally instead of blowing out the reading column.
          table: (props) => (
            <div className="overflow-x-auto">
              <table {...props} />
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
