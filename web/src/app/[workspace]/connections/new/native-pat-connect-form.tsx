"use client";

import { useActionState } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/lib/use-action-toast";

import {
  connectNativePatAction,
  type SimpleConnectionActionState,
} from "../native-mcp-actions";

const INITIAL: SimpleConnectionActionState = {};

// Connect form for authMode "pat" native-MCP providers (GitHub PAT, X
// App-only Bearer, …). User pastes a static bearer token; the server
// action verifies it against the MCP server, then stores authType "pat".
export function NativePatConnectForm({
  workspaceSlug,
  providerSlug,
  displayName,
  patHint,
}: {
  workspaceSlug: string;
  providerSlug: string;
  displayName: string;
  patHint?: string;
}) {
  const [name, setName] = useState("default");
  const [state, formAction, pending] = useActionState(
    connectNativePatAction,
    INITIAL,
  );
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="provider" value={providerSlug} />

      <div className="grid gap-1.5">
        <Label htmlFor="pat-name" className="text-sm">
          Connection name
        </Label>
        <Input
          id="pat-name"
          name="name"
          required
          pattern="[a-z0-9_-]+"
          autoComplete="off"
          spellCheck={false}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="default"
          disabled={pending}
        />
        <p className="text-foreground-muted text-sm">
          Distinguishes multiple accounts for the same provider (e.g.{" "}
          <code>work</code>, <code>personal</code>).
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="pat-token" className="text-sm">
          {displayName} token
        </Label>
        <Input
          id="pat-token"
          name="token"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste token"
          disabled={pending}
        />
        {patHint && (
          <p className="text-foreground-muted text-sm">{patHint}</p>
        )}
      </div>

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Connecting…" : "Connect"}
        </Button>
      </div>

      {state.error && (
        <div className="border-sentiment-negative bg-[var(--color-input-error)] rounded-lg border p-3 text-sm">
          <span className="text-foreground">{state.error}</span>
        </div>
      )}
    </form>
  );
}
