"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/lib/use-action-toast";

import {
  removePersonalTemboKeyAction,
  savePersonalTemboKeyAction,
  type PersonalTemboFormState,
} from "./tembo-actions";

const INITIAL: PersonalTemboFormState = {};

export function PersonalTemboKeyForm({
  workspaceSlug,
  preview,
}: {
  workspaceSlug: string;
  preview: { last4: string; updatedAt: string } | null;
}) {
  const [rotating, setRotating] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [saveState, saveAction, savePending] = useActionState(
    savePersonalTemboKeyAction,
    INITIAL,
  );
  useActionToast(saveState);
  const [removeState, removeAction, removePending] = useActionState(
    removePersonalTemboKeyAction,
    INITIAL,
  );
  useActionToast(removeState);

  if (preview && !rotating) {
    return (
      <div className="flex flex-col gap-3">
        <div className="bg-surface border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <div className="flex flex-col">
            <span className="text-foreground text-sm font-medium">
              ••••••••{preview.last4}
            </span>
            <span className="text-foreground-muted text-sm">
              Your Tembo identity will be used for new coding-agent work.
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
                {removePending ? "Disconnecting…" : "Disconnect"}
              </Button>
            </form>
          </div>
        </div>
        {removeState.message && (
          <p className="text-foreground-weak text-sm">{removeState.message}</p>
        )}
      </div>
    );
  }

  return (
    <form action={saveAction} className="flex flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <div className="grid gap-1.5">
        <Label htmlFor="personal-tembo-api-key" className="text-sm">
          {preview ? "New personal Tembo API key" : "Personal Tembo API key"}
        </Label>
        <Input
          id="personal-tembo-api-key"
          name="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          disabled={savePending}
          placeholder="Paste your Tembo API key"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
        <p className="text-foreground-muted text-sm">
          Validated with Tembo and stored encrypted. If disconnected, TAS uses
          the workspace fallback account.
        </p>
      </div>
      {saveState.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {saveState.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          size="big"
          disabled={savePending}
        >
          {savePending ? "Connecting…" : preview ? "Save new key" : "Connect"}
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
