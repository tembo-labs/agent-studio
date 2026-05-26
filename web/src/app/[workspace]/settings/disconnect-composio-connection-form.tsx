"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import {
  disconnectComposioConnectionAction,
  type DisconnectComposioConnectionFormState,
} from "./actions";

const INITIAL: DisconnectComposioConnectionFormState = {};

export function DisconnectComposioConnectionForm({
  workspaceSlug,
  connectionId,
}: {
  workspaceSlug: string;
  connectionId: string;
}) {
  const [state, formAction, pending] = useActionState(
    disconnectComposioConnectionAction,
    INITIAL,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <input type="hidden" name="connectionId" value={connectionId} />
        <Button type="submit" variant="ghost" size="small" disabled={pending}>
          {pending ? "Disconnecting…" : "Disconnect"}
        </Button>
      </form>
      {state.error && (
        <p className="text-sentiment-negative max-w-xs text-right text-xs">
          {state.error}
        </p>
      )}
    </div>
  );
}
