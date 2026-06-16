"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { useActionToast } from "@/lib/use-action-toast";

import {
  refreshNativeMcpToolsAction,
  type SimpleConnectionActionState,
} from "./native-mcp-actions";

const INITIAL: SimpleConnectionActionState = {};

// Re-prime the cached tool list when the MCP server adds tools or an older
// connection needs a backfill. Rendered as a button in the detail-view action
// cluster; errors surface via toast.
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
