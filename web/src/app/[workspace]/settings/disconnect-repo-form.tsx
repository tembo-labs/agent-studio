"use client";

import { useActionState } from "react";
import { useActionToast } from "@/lib/use-action-toast";

import { Button } from "@/components/ui/button";

import {
  disconnectRepoAction,
  type DisconnectRepoFormState,
} from "./actions";

const INITIAL: DisconnectRepoFormState = {};

export function DisconnectRepoForm({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const [state, formAction, pending] = useActionState(
    disconnectRepoAction,
    INITIAL,
  );
  useActionToast(state);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <Button
          type="submit"
          variant="ghost"
          size="small"
          disabled={pending}
        >
          {pending ? "Disconnecting…" : "Disconnect"}
        </Button>
      </form>
      {state.message && (
        <p className="text-foreground-weak text-sm">{state.message}</p>
      )}
    </div>
  );
}
