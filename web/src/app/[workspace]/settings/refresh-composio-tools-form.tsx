"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { useActionToast } from "@/lib/use-action-toast";

import {
  refreshComposioToolsAction,
  type RefreshComposioToolsFormState,
} from "./actions";

const INITIAL: RefreshComposioToolsFormState = {};

// Re-prime a Composio connection's cached tool list. Rendered as a button in
// the connection detail-view action cluster; errors surface via toast.
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
  useActionToast(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="connectionId" value={connectionId} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Refreshing…" : (label ?? "Refresh tools")}
      </Button>
    </form>
  );
}
