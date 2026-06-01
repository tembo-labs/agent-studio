"use client";

import { useActionState } from "react";
import { useActionToast } from "@/lib/use-action-toast";

import { Button } from "@/components/ui/button";

import {
  restoreAgentAction,
  type RestoreAgentFormState,
} from "./actions";

const INITIAL: RestoreAgentFormState = {};

type Props = {
  workspaceSlug: string;
  deletionId: string;
};

export function RestoreAgentForm({ workspaceSlug, deletionId }: Props) {
  const [state, formAction, pending] = useActionState(
    restoreAgentAction,
    INITIAL,
  );
  useActionToast(state);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <input type="hidden" name="deletionId" value={deletionId} />
        <Button
          type="submit"
          variant="ghost"
          size="small"
          disabled={pending}
        >
          {pending ? "Restoring…" : "Restore"}
        </Button>
      </form>
      {state.error && (
        <p className="text-sentiment-negative max-w-xs text-right text-sm">
          {state.error}
        </p>
      )}
    </div>
  );
}
