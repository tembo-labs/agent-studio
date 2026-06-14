"use client";

import { useActionState } from "react";
import { useActionToast } from "@/lib/use-action-toast";

import {
  removeDefunctNativeConnectionsAction,
  type SimpleConnectionActionState,
} from "./native-mcp-actions";

const INITIAL: SimpleConnectionActionState = {};

// Banner shown when the user holds native-MCP connections to a provider that's
// no longer in the catalog (e.g. the old `tembo` self-key connection after the
// rename). Those rows don't render as normal connection cards, so this is the
// only way to clear them — it deletes the rows + revokes any minted tas_ key.
export function RemoveDefunctNativeForm({
  workspaceSlug,
  defunctSlugs,
}: {
  workspaceSlug: string;
  defunctSlugs: string[];
}) {
  const [state, formAction, pending] = useActionState(
    removeDefunctNativeConnectionsAction,
    INITIAL,
  );
  useActionToast(state);
  return (
    <div className="border-sentiment-negative bg-[var(--color-input-error)] flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
      <span className="text-foreground">
        You have {defunctSlugs.length} connection
        {defunctSlugs.length === 1 ? "" : "s"} to a removed provider (
        <code>{defunctSlugs.join(", ")}</code>) that no longer works. Remove to
        clear them and revoke any leftover key.
      </span>
      <form action={formAction}>
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <button
          type="submit"
          disabled={pending}
          className="text-foreground hover:text-sentiment-negative shrink-0 font-medium hover:underline disabled:opacity-60"
        >
          {pending ? "Removing…" : "Remove"}
        </button>
      </form>
    </div>
  );
}
