"use client";

import { useActionState } from "react";

import {
  disconnectNativeMcpConnectionAction,
  type SimpleConnectionActionState,
} from "./native-mcp-actions";

const INITIAL: SimpleConnectionActionState = {};

// Plain text-link styling matches the Composio Disconnect row so
// both connection modes share a visual rhythm on the Connections
// page. Destructive intent is signaled by the sentiment-negative
// hover color, not a heavy button background.
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
  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <input type="hidden" name="connectionId" value={connectionId} />
        <button
          type="submit"
          disabled={pending}
          className="text-foreground hover:text-sentiment-negative text-sm font-medium hover:underline disabled:opacity-60"
        >
          {pending ? "Disconnecting…" : "Disconnect"}
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
