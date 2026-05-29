"use client";

import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { toolkitLabel } from "@/lib/composio-label";
import type { McpTool } from "@/lib/mcp-tools";

import { CopyableSlug } from "./copyable-slug";

// Side panel that opens when you click a row in the Tools table.
// Shows the slug + full description + connection metadata at sizes
// you can actually read, plus the YAML snippet to copy into an
// agent's `connections:` block — the most common reason someone
// opens this drawer is "I want this tool in an agent."

type Props = {
  tool: McpTool | null;
  onClose: () => void;
};

export function ToolDetailDrawer({ tool, onClose }: Props) {
  // Esc-to-close is a hard expectation for slide-over panels.
  // Listening on document means the user doesn't have to focus
  // the drawer first — clicking a row to open and immediately
  // hitting Esc should work even if the row stayed focused.
  useEffect(() => {
    if (!tool) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tool, onClose]);

  const providerLabel = tool
    ? tool.source === "composio"
      ? toolkitLabel(tool.provider)
      : tool.provider
    : "";

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity " +
          (tool ? "opacity-100" : "pointer-events-none opacity-0")
        }
      />
      <aside
        role="dialog"
        aria-label={tool ? `${tool.slug} details` : "Tool details"}
        aria-hidden={!tool}
        className={
          "bg-surface border-border fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col gap-4 overflow-y-auto border-l shadow-2xl transition-transform duration-200 ease-out " +
          (tool ? "translate-x-0" : "translate-x-full")
        }
      >
        {tool && (
          <>
            <div className="border-border-weak flex items-start justify-between gap-3 border-b px-5 py-4">
              <div className="flex min-w-0 flex-col gap-1">
                <CopyableSlug
                  slug={tool.slug}
                  className="text-foreground break-all text-base font-semibold"
                />
                {tool.displayName && tool.displayName !== tool.slug && (
                  <p className="text-foreground-weak text-sm">
                    {tool.displayName}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-foreground-weak hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-4 px-5 pb-6">
              <div className="flex flex-wrap items-baseline gap-2">
                <Badge
                  variant={tool.source === "composio" ? "blue" : "gray"}
                  size="small"
                >
                  {tool.source === "composio" ? "Composio" : "Native MCP"}
                </Badge>
                <span className="text-foreground-weak text-sm">
                  {providerLabel}
                </span>
                <code className="text-foreground-muted text-sm">
                  · {tool.connectionName}
                </code>
              </div>

              {tool.description ? (
                <div>
                  <div className="text-foreground-weak text-sm font-medium uppercase tracking-widest">
                    Description
                  </div>
                  <p className="text-foreground mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              ) : (
                <p className="text-foreground-weak text-sm">
                  No description provided by the upstream catalog.
                </p>
              )}

              <div>
                <div className="text-foreground-weak text-sm font-medium uppercase tracking-widest">
                  Use this tool in an agent
                </div>
                <pre className="bg-surface-secondary text-foreground mt-1 overflow-x-auto rounded-md p-3 text-sm leading-relaxed">
                  {snippetFor(tool)}
                </pre>
                <p className="text-foreground-weak mt-2 text-sm">
                  Paste into the agent&apos;s{" "}
                  <code className="bg-surface rounded px-1 py-0.5 text-sm">
                    connections:
                  </code>{" "}
                  list. The slug is verbatim — copy from above if you need
                  it elsewhere.
                </p>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function snippetFor(tool: McpTool): string {
  // Native-MCP entries need the verbose form so `source` is
  // explicit; Composio defaults to source="composio" so the
  // compact form is fine and clearer for the docs case.
  if (tool.source === "native-mcp") {
    return `connections:
  - { type: ${tool.provider}, source: native-mcp, name: ${tool.connectionName}, tools: [${tool.slug}] }`;
  }
  return `connections:
  - ${tool.provider}:
      name: ${tool.connectionName}
      tools: [${tool.slug}]`;
}
