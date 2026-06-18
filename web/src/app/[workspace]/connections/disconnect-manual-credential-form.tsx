"use client";

// Disconnect a manual-credential provider — deletes all its field secrets.
// Two-step inline confirm, mirroring the other disconnect forms.

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { useActionToast } from "@/lib/use-action-toast";

import {
  removeManualCredentialAction,
  type ManualCredFormState,
} from "./manual-credential-actions";

const INITIAL: ManualCredFormState = {};

export function DisconnectManualCredentialForm({
  workspaceSlug,
  providerSlug,
}: {
  workspaceSlug: string;
  providerSlug: string;
}) {
  const [state, formAction, pending] = useActionState(
    removeManualCredentialAction,
    INITIAL,
  );
  useActionToast(state);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="destructive"
        onClick={() => setConfirming(true)}
      >
        Disconnect
      </Button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="provider" value={providerSlug} />
      <span className="text-foreground-weak text-sm">Disconnect?</span>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "…" : "Yes, disconnect"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </form>
  );
}
