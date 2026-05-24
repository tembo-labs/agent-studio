"use client";

import { useState, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  removeSecretAction,
  saveSecretAction,
  type SecretFormState,
} from "./actions";

const INITIAL: SecretFormState = {};

type Props = {
  workspaceSlug: string;
  kind: "tembo_api_key" | "anthropic_api_key";
  /** Short label used in the input ("Tembo API key") */
  label: string;
  /** Placeholder shown in the input field */
  placeholder: string;
  /** Static prefix shown in the masked preview (e.g. "tembo_") */
  maskedPrefix: string;
  preview: { last4: string; updatedAt: string } | null;
};

export function SecretKeyForm({
  workspaceSlug,
  kind,
  label,
  placeholder,
  maskedPrefix,
  preview,
}: Props) {
  const [rotating, setRotating] = useState(false);
  const [saveState, saveAction, savePending] = useActionState(
    saveSecretAction,
    INITIAL,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeSecretAction,
    INITIAL,
  );

  const showForm = !preview || rotating;

  if (!showForm && preview) {
    return (
      <div className="flex flex-col gap-3">
        <div className="bg-surface border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <div className="flex flex-col">
            <span className="text-foreground text-sm font-medium">
              {maskedPrefix}••••••••{preview.last4}
            </span>
            <span className="text-foreground-muted text-xs">
              Last set {formatDate(preview.updatedAt)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="small"
              onClick={() => setRotating(true)}
            >
              Rotate
            </Button>
            <form action={removeAction}>
              <input type="hidden" name="workspace" value={workspaceSlug} />
              <input type="hidden" name="kind" value={kind} />
              <Button
                type="submit"
                variant="ghost"
                size="small"
                disabled={removePending}
              >
                {removePending ? "Removing…" : "Remove"}
              </Button>
            </form>
          </div>
        </div>
        {removeState.message && (
          <p className="text-foreground-weak text-xs">{removeState.message}</p>
        )}
      </div>
    );
  }

  const inputId = `${kind}-input`;
  return (
    <form action={saveAction} className="flex flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-1.5">
        <Label htmlFor={inputId} className="text-sm">
          {preview ? `New ${label}` : label}
        </Label>
        <Input
          id={inputId}
          name="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          disabled={savePending}
          placeholder={placeholder}
        />
        <p className="text-foreground-muted text-xs">
          Stored encrypted at rest (AES-256-GCM). Only the last four characters
          are kept in cleartext for the masked preview.
        </p>
      </div>

      {saveState.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {saveState.error}
        </p>
      )}
      {saveState.message && (
        <p className="text-foreground-weak text-xs">{saveState.message}</p>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          size="big"
          disabled={savePending}
        >
          {savePending ? "Saving…" : preview ? "Save new key" : "Save"}
        </Button>
        {preview && (
          <Button
            type="button"
            variant="ghost"
            size="big"
            onClick={() => setRotating(false)}
            disabled={savePending}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
