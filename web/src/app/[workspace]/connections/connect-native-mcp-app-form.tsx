"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

// Connect a manual (BYO-app) Native MCP provider. Unlike DCR providers, you
// can't type a free-form name — you pick one of the OAuth app instances an
// admin registered, and the authorize flow uses that app's confidential client.
// The instance slug doubles as the connection name.

export function ConnectNativeMcpAppForm({
  workspaceSlug,
  providerSlug,
  instances,
}: {
  workspaceSlug: string;
  providerSlug: string;
  instances: { instance: string; label: string | null }[];
}) {
  const [instance, setInstance] = useState<string>(
    instances[0]?.instance ?? "",
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!instance) return;
    const params = new URLSearchParams({
      workspace: workspaceSlug,
      app: instance,
    });
    window.location.href = `/api/connections/native/${providerSlug}/authorize?${params.toString()}`;
  }

  if (instances.length === 0) return null;

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      {instances.length > 1 ? (
        <select
          aria-label="OAuth app instance"
          value={instance}
          onChange={(e) => setInstance(e.target.value)}
          className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
        >
          {instances.map((i) => (
            <option key={i.instance} value={i.instance}>
              {i.label ? `${i.label} (${i.instance})` : i.instance}
            </option>
          ))}
        </select>
      ) : null}
      <Button type="submit" variant="primary" size="small">
        Connect
      </Button>
    </form>
  );
}
