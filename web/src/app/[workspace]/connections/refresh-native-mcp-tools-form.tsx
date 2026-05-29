"use client";

import { useActionState } from "react";

import {
  refreshNativeMcpToolsAction,
  type SimpleConnectionActionState,
} from "./native-mcp-actions";

const INITIAL: SimpleConnectionActionState = {};

// Sibling of DisconnectNativeMcpConnectionForm — text-link styling
// to share the same row rhythm. Used to re-prime the cached tool
// list when the MCP server adds new tools or when an older
// connection (made before tool-cache existed) needs a backfill.
export function RefreshNativeMcpToolsForm({
  workspaceSlug,
  connectionId,
  label,
}: {
  workspaceSlug: string;
  connectionId: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(
    refreshNativeMcpToolsAction,
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
          className="text-foreground-weak hover:text-foreground text-sm font-medium hover:underline disabled:opacity-60"
        >
          {pending ? "Refreshing…" : (label ?? "Refresh tools")}
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
