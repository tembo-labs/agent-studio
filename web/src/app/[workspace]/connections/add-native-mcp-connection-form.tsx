"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { McpProvider } from "@/lib/mcp-providers";

// Mirror of the Composio "Add another" form — pre-authorize a named
// slot for a native-MCP provider so you can hold multiple accounts
// (work Attio + personal Attio, two Notion workspaces, etc.) without
// waiting for an agent to declare the slot.
//
// The authorize endpoint encodes the provider in the URL path
// (/api/connections/native/<provider>/authorize), not a query
// param, so we can't use the same plain GET-form trick the Composio
// version does. Instead this is a tiny client component that builds
// the URL on submit and navigates. No server action — Connect just
// jumps the user into the existing OAuth-discovery flow.

export function AddNativeMcpConnectionForm({
  workspaceSlug,
  catalog,
}: {
  workspaceSlug: string;
  catalog: McpProvider[];
}) {
  const [providerSlug, setProviderSlug] = useState<string>(
    catalog[0]?.slug ?? "",
  );
  const [name, setName] = useState<string>("default");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!providerSlug) return;
    const params = new URLSearchParams({ workspace: workspaceSlug });
    const trimmed = name.trim().toLowerCase();
    if (trimmed && trimmed !== "default") {
      params.set("name", trimmed);
    }
    window.location.href = `/api/connections/native/${providerSlug}/authorize?${params.toString()}`;
  }

  if (catalog.length === 0) return null;

  return (
    <form
      onSubmit={onSubmit}
      className="bg-surface border-border flex flex-col gap-2 rounded-lg border border-dashed px-3 py-3"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground text-sm font-medium">
          Add another Native MCP connection
        </span>
        <span className="text-foreground-muted text-sm">
          Authorize a second account for a provider you already use, or
          pre-authorize a name slot before an agent declares it. Name
          distinguishes accounts (e.g. <code>work</code>, <code>personal</code>).
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-[180px] flex-1 flex-col gap-1">
          <label
            htmlFor="add-native-provider"
            className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
          >
            Provider
          </label>
          <select
            id="add-native-provider"
            value={providerSlug}
            onChange={(e) => setProviderSlug(e.target.value)}
            className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
          >
            {catalog.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[140px] flex-1 flex-col gap-1">
          <label
            htmlFor="add-native-name"
            className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
          >
            Name
          </label>
          <input
            id="add-native-name"
            name="name"
            type="text"
            required
            pattern="[a-z0-9_-]+"
            autoComplete="off"
            spellCheck={false}
            placeholder="work"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
          />
        </div>
        <Button type="submit" variant="primary" size="small">
          Connect
        </Button>
      </div>
    </form>
  );
}
