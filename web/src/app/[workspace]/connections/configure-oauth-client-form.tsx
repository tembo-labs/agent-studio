"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type McpProvider,
  redirectUriFor,
  setupInstructionsFor,
} from "@/lib/mcp-providers";

import {
  saveNativeMcpOAuthClientAction,
  type SaveOAuthClientFormState,
} from "./oauth-client-actions";

const INITIAL: SaveOAuthClientFormState = {};

type Props = {
  workspaceSlug: string;
  provider: McpProvider;
};

export function ConfigureOAuthClientForm({ workspaceSlug, provider }: Props) {
  const [state, formAction, pending] = useActionState(
    saveNativeMcpOAuthClientAction,
    INITIAL,
  );
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // Instructions are a 3-line markdown template with {{REDIRECT_URI}}
  // baked in. Rendering as a <pre> keeps the URL one-line copy-able;
  // we don't drag in a full markdown renderer for three bullets.
  const instructions = setupInstructionsFor(provider.slug);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="provider" value={provider.slug} />

      <pre className="text-foreground-weak bg-surface-secondary border-border whitespace-pre-wrap rounded-lg border px-3 py-2 text-xs leading-5">
        {instructions}
      </pre>
      <p className="text-foreground-weak text-xs">
        Redirect URI to paste:{" "}
        <code className="text-foreground bg-surface rounded px-1 py-0.5 text-[11px]">
          {redirectUriFor(provider.slug)}
        </code>
      </p>

      <div className="grid gap-1.5">
        <Label htmlFor={`${provider.slug}-client-id`} className="text-sm">
          Client ID
        </Label>
        <Input
          id={`${provider.slug}-client-id`}
          name="client_id"
          type="text"
          autoComplete="off"
          spellCheck={false}
          required
          disabled={pending}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
        {state.fieldErrors?.clientId && (
          <span className="text-sentiment-negative text-xs">
            {state.fieldErrors.clientId}
          </span>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${provider.slug}-client-secret`} className="text-sm">
          Client Secret
        </Label>
        <Input
          id={`${provider.slug}-client-secret`}
          name="client_secret"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          disabled={pending}
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
        />
        <p className="text-foreground-muted text-xs">
          Stored encrypted at rest (AES-256-GCM).
        </p>
        {state.fieldErrors?.clientSecret && (
          <span className="text-sentiment-negative text-xs">
            {state.fieldErrors.clientSecret}
          </span>
        )}
      </div>

      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="text-foreground-weak text-xs">{state.message}</p>
      )}

      <div>
        <Button type="submit" variant="primary" size="small" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
