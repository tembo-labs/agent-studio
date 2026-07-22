// Human-friendly rendering of an inbox item's `context` payload. The payload is
// arbitrary JSON (source-agnostic), so we render it generically as labeled
// fields — humanized keys, readable values, nested objects/arrays indented —
// instead of dumping raw JSON at the person triaging it.

import type { ReactNode } from "react";

import { Markdown } from "@/components/markdown";

// Agents routinely put Markdown in context fields (the digest agents write
// whole documents). Only strings that clearly use markdown syntax are routed
// through the Markdown renderer — plain text keeps `whitespace-pre-wrap`,
// because markdown collapses single newlines and would mangle the line
// breaks of ordinary multiline values.
const MARKDOWN_MARKERS = [
  /^#{1,6}\s/m, // heading
  /\*\*[^*\n]+\*\*/, // bold
  /^\s*[-*+]\s+\S/m, // bullet list
  /^\s*\d+\.\s+\S/m, // ordered list
  /\[[^\]\n]+\]\([^)\s]+\)/, // link
  /^```/m, // fenced code
  /^>\s/m, // blockquote
];

export function looksLikeMarkdown(s: string): boolean {
  return MARKDOWN_MARKERS.some((re) => re.test(s));
}

// A context of exactly `{ text: "<markdown>" }` is a document, not a payload —
// it's what produce_inbox_item stores when the producer passes a plain string,
// and the digest agents write whole newsletters that way. Returns the text so
// the item page can render it as full-width prose instead of a labeled field
// inside a box; anything else (structured payloads, plain non-markdown text
// whose line breaks need pre-wrap) returns null and keeps the fields view.
export function documentText(context: Record<string, unknown>): string | null {
  if (!isPlainObject(context)) return null;
  const keys = Object.keys(context);
  if (keys.length !== 1 || keys[0] !== "text") return null;
  const text = context.text;
  if (typeof text !== "string" || !looksLikeMarkdown(text)) return null;
  return text;
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function Empty() {
  return <span className="text-foreground-muted">—</span>;
}

function Value({ value }: { value: unknown }): ReactNode {
  if (value === null || value === undefined || value === "") return <Empty />;
  if (typeof value === "string") {
    // Render a URL as a link; everything else as wrapped text.
    if (/^https?:\/\/\S+$/.test(value)) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noreferrer noopener"
          className="text-foreground hover:underline"
        >
          {value}
        </a>
      );
    }
    if (looksLikeMarkdown(value)) {
      return <Markdown>{value}</Markdown>;
    }
    return <span className="whitespace-pre-wrap">{value}</span>;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span>{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <Empty />;
    // Array of primitives → comma-separated; array of objects → stacked cards.
    if (value.every((v) => !isPlainObject(v) && !Array.isArray(v))) {
      return <span>{value.map((v) => String(v)).join(", ")}</span>;
    }
    return (
      <div className="flex flex-col gap-3">
        {value.map((v, i) => (
          <div
            key={i}
            className="border-[var(--color-border-weak)] border-l-2 pl-3"
          >
            <Fields data={v} />
          </div>
        ))}
      </div>
    );
  }
  if (isPlainObject(value)) {
    return (
      <div className="border-[var(--color-border-weak)] border-l-2 pl-3">
        <Fields data={value} />
      </div>
    );
  }
  return <Empty />;
}

function Fields({ data }: { data: unknown }): ReactNode {
  if (!isPlainObject(data)) return <Value value={data} />;
  const entries = Object.entries(data);
  if (entries.length === 0) return <Empty />;
  return (
    <dl className="flex flex-col gap-3">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-0.5">
          <dt className="text-foreground-muted text-xs font-medium uppercase tracking-wide">
            {humanizeKey(key)}
          </dt>
          <dd className="text-foreground text-sm leading-6">
            <Value value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ContextView({ context }: { context: Record<string, unknown> }) {
  if (!context || Object.keys(context).length === 0) {
    return (
      <p className="text-foreground-weak text-sm">No additional detail.</p>
    );
  }
  return <Fields data={context} />;
}
