"use client";

import { useState, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  removeTemboApiKeyAction,
  saveTemboApiKeyAction,
  type TemboApiKeyFormState,
} from "./actions";

const INITIAL: TemboApiKeyFormState = {};

type Props = {
  workspaceSlug: string;
  preview: { last4: string; updatedAt: string } | null;
};

export function TemboApiKeyForm({ workspaceSlug, preview }: Props) {
  const [rotating, setRotating] = useState(false);
  const [saveState, saveAction, savePending] = useActionState(
    saveTemboApiKeyAction,
    INITIAL,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeTemboApiKeyAction,
    INITIAL,
  );

  // After a successful save, collapse back to the masked-preview view.
  const showForm = !preview || rotating;

  if (!showForm && preview) {
    return (
      <div className="flex flex-col gap-3">
        <div className="bg-surface border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <div className="flex flex-col">
            <span className="text-foreground text-sm font-medium">
              tembo_••••••••{preview.last4}
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

  return (
    <form action={saveAction} className="flex flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <div className="grid gap-1.5">
        <Label htmlFor="apiKey" className="text-sm">
          {preview ? "New Tembo API key" : "Tembo API key"}
        </Label>
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          disabled={savePending}
          placeholder="tembo_pk_…"
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
