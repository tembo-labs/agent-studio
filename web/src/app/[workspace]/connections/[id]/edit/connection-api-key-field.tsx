"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { message?: string; error?: string };
type Action = (state: State, formData: FormData) => Promise<State>;

// Optional supplementary API key on a native-MCP connection. Some providers'
// MCP OAuth grants only coarse scopes (Attio: no record/note/delete), so a
// privileged provider access token is needed for those ops. The key rides the
// connection (per-user, bundled) instead of a separate shared secret. The value
// is write-only here — never read back; we only know whether one is set.
export function ConnectionApiKeyField({
  action,
  workspaceSlug,
  connectionId,
  providerLabel,
  hint,
  isSet,
}: {
  action: Action;
  workspaceSlug: string;
  connectionId: string;
  providerLabel: string;
  /** Provider-specific note (why/what scopes); falls back to generic copy. */
  hint?: string | null;
  isSet: boolean;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    action,
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="connectionId" value={connectionId} />
      <div className="grid gap-1.5">
        <Label htmlFor="api-key" className="text-sm">
          API key{" "}
          <span className="text-foreground-muted">
            (optional{isSet ? " — set" : ""})
          </span>
        </Label>
        <Input
          id="api-key"
          name="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={
            isSet ? "•••••••• — paste to replace" : "Paste a provider API key"
          }
          disabled={pending}
        />
        <p className="text-foreground-muted text-sm">
          {hint ? (
            hint
          ) : (
            <>
              For privileged operations the {providerLabel} MCP token can&apos;t
              do — e.g. writes or deletes that need a granular provider access
              token. Agents read it via{" "}
              <code>tas_tools.connection().api_key</code>.
            </>
          )}{" "}
          Stored encrypted and scoped to your connection — other members
          can&apos;t use it.
        </p>
      </div>
      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="text-sentiment-positive text-sm">{state.message}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save API key"}
        </Button>
        {isSet && (
          <Button
            type="submit"
            name="clear"
            value="true"
            variant="secondary"
            disabled={pending}
          >
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}
