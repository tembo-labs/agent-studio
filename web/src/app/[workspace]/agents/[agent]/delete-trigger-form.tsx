"use client";

import { useActionState } from "react";
import { useActionToast } from "@/lib/use-action-toast";

import { deleteTriggerAction, type SimpleTriggerActionState } from "./actions";

const INITIAL: SimpleTriggerActionState = {};

export function DeleteTriggerForm({
  workspaceSlug,
  id,
}: {
  workspaceSlug: string;
  id: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteTriggerAction,
    INITIAL,
  );
  useActionToast(state);
  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={pending}
          className="text-foreground hover:text-sentiment-negative text-sm font-medium hover:underline disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
      </form>
      {state.error && (
        <p className="text-sentiment-negative max-w-xs text-right text-xs">
          {state.error}
        </p>
      )}
    </div>
  );
}
