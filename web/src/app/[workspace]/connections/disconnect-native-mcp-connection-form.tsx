"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { useActionToast } from "@/lib/use-action-toast";

import {
  disconnectNativeMcpConnectionAction,
  type SimpleConnectionActionState,
} from "./native-mcp-actions";

const INITIAL: SimpleConnectionActionState = {};

// Disconnect (delete) a native-MCP connection. Rendered as a destructive
// button in the detail-view action cluster; on success the action redirects
// back to the Connections list.
export function DisconnectNativeMcpConnectionForm({
  workspaceSlug,
  connectionId,
}: {
  workspaceSlug: string;
  connectionId: string;
}) {
  const [state, formAction, pending] = useActionState(
    disconnectNativeMcpConnectionAction,
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
