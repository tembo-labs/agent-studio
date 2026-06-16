"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { useActionToast } from "@/lib/use-action-toast";

import {
  disconnectComposioConnectionAction,
  type DisconnectComposioConnectionFormState,
} from "./actions";

const INITIAL: DisconnectComposioConnectionFormState = {};

// Disconnect (delete) a Composio connection. Rendered as a destructive button
// in the connection detail-view action cluster; on success the action
// redirects back to the Connections list.
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
  useActionToast(state);

  return (
    <form action={formAction}>
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="connectionId" value={connectionId} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Disconnecting…" : "Disconnect"}
      </Button>
    </form>
  );
}
