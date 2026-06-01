"use client";

import { useActionState } from "react";
import { useActionToast } from "@/lib/use-action-toast";

import { Button } from "@/components/ui/button";

import { syncGuidanceAction, type SyncGuidanceFormState } from "./actions";

const INITIAL: SyncGuidanceFormState = {};

export function SyncGuidanceForm({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const [state, formAction, pending] = useActionState(
    syncGuidanceAction,
    INITIAL,
  );
  useActionToast(state);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Syncing…" : "Sync agent guidance"}
        </Button>
      </form>
      {state.message && (
        <p className="text-foreground-weak text-sm">{state.message}</p>
      )}
      {state.error && (
        <p className="text-sentiment-negative text-sm">{state.error}</p>
      )}
    </div>
  );
}
