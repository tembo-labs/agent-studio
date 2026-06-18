"use client";

// Connect/edit form for a "manual credential" provider: one input per declared
// field, written to workspace secrets under the field keys. Used both for the
// initial connect (/connections/new) and to update values (/connections/[id]).
// On edit, already-set fields show a "leave blank to keep" hint (values are
// write-only — we never read secrets back to the browser).

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { ManualCredentialProvider } from "@/lib/manual-credential-providers";
import { useActionToast } from "@/lib/use-action-toast";

import {
  setManualCredentialAction,
  type ManualCredFormState,
} from "./manual-credential-actions";

const INITIAL: ManualCredFormState = {};

export function ManualCredentialConnectForm({
  workspaceSlug,
  provider,
  setFields,
}: {
  workspaceSlug: string;
  provider: ManualCredentialProvider;
  /** Field keys already stored (their inputs may be left blank to keep). */
  setFields?: string[];
}) {
  const [state, formAction, pending] = useActionState(
    setManualCredentialAction,
    INITIAL,
  );
  useActionToast(state);
  const already = new Set(setFields ?? []);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="provider" value={provider.slug} />

      {provider.fields.map((f) => {
        const isSet = already.has(f.key);
        return (
          <div key={f.key} className="flex flex-col gap-1">
            <label htmlFor={f.key} className="text-foreground text-sm font-medium">
              {f.label}
              {f.required && !isSet && <span className="text-sentiment-negative"> *</span>}
            </label>
            <input
              id={f.key}
              name={f.key}
              type={f.type === "password" ? "password" : "text"}
              required={f.required && !isSet}
              placeholder={isSet ? "•••••••• (leave blank to keep)" : f.placeholder}
              autoComplete="off"
              disabled={pending}
              className="bg-input border-border text-foreground rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
            />
            {f.help && <p className="text-foreground-weak text-sm">{f.help}</p>}
          </div>
        );
      })}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save connection"}
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
