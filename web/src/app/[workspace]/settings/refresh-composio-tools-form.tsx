"use client";

import { useActionState } from "react";

import {
  refreshComposioToolsAction,
  type RefreshComposioToolsFormState,
} from "./actions";

const INITIAL: RefreshComposioToolsFormState = {};

// Mirror of RefreshNativeMcpToolsForm — text-link styling so both
// connection-mode rows share the same visual rhythm.
export function RefreshComposioToolsForm({
  workspaceSlug,
  connectionId,
  label,
}: {
  workspaceSlug: string;
  connectionId: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(
    refreshComposioToolsAction,
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
