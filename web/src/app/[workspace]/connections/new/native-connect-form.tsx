"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Connect a single DCR / self-key native-MCP provider. The provider is fixed
// (the picker already chose it), so this is just an optional connection-name
// slot + Connect, which jumps into the OAuth-discovery flow.
export function NativeConnectForm({
  workspaceSlug,
  providerSlug,
  selfKey = false,
}: {
  workspaceSlug: string;
  providerSlug: string;
  selfKey?: boolean;
}) {
  const [name, setName] = useState("default");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams({ workspace: workspaceSlug });
    const trimmed = name.trim().toLowerCase();
    if (trimmed && trimmed !== "default") params.set("name", trimmed);
    window.location.href = `/api/connections/native/${providerSlug}/authorize?${params.toString()}`;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {!selfKey && (
        <div className="grid gap-1.5">
          <Label htmlFor="native-name" className="text-sm">
            Connection name
          </Label>
          <Input
            id="native-name"
            name="name"
            required
            pattern="[a-z0-9_-]+"
            autoComplete="off"
            spellCheck={false}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="default"
          />
          <p className="text-foreground-muted text-sm">
            Distinguishes multiple accounts for the same provider (e.g.{" "}
            <code>work</code>, <code>personal</code>).
          </p>
        </div>
      )}
      <div>
        <Button type="submit" variant="primary">
          Connect →
        </Button>
      </div>
    </form>
  );
}
