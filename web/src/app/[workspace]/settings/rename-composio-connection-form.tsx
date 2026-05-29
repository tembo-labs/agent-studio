"use client";

import { useActionState, useState } from "react";
import { useActionToast } from "@/lib/use-action-toast";

import { Button } from "@/components/ui/button";

import {
  renameComposioConnectionAction,
  type RenameComposioConnectionFormState,
} from "./actions";

const INITIAL: RenameComposioConnectionFormState = {};

// Inline rename for a Composio connection slot. Toggles between a
// "Rename" link (idle) and a small input + Save / Cancel (editing).
// Surfaces the side-effect warning above the input so users
// understand renaming breaks any agent file that pinned the old
// name.

export function RenameComposioConnectionForm({
  workspaceSlug,
  connectionId,
  currentName,
}: {
  workspaceSlug: string;
  connectionId: string;
  currentName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentName);
  const [state, formAction, pending] = useActionState(
    renameComposioConnectionAction,
    INITIAL,
  );
  useActionToast(state);

  // Successful submits close the editor; errors keep it open so the
  // user can correct without re-clicking Rename.
  if (state.message && editing) {
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(currentName);
          setEditing(true);
        }}
        className="text-foreground hover:text-foreground-title text-sm font-medium hover:underline"
      >
        Rename
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="connectionId" value={connectionId} />
      <div className="flex items-center gap-1">
        <input
          name="newName"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          pattern="[a-z0-9_-]+"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          className="bg-input border-border text-foreground w-28 rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
        />
        <Button type="submit" variant="primary" size="small" disabled={pending}>
          {pending ? "…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="small"
          disabled={pending}
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      </div>
      {state.error && (
        <p
          role="alert"
          className="text-sentiment-negative max-w-[220px] text-right text-xs leading-tight"
        >
          {state.error}
        </p>
      )}
      <p className="text-foreground-muted max-w-[220px] text-right text-xs leading-tight">
        Update any agent file that references{" "}
        <code className="bg-surface rounded px-1 py-0.5 text-xs">
          {currentName}
        </code>{" "}
        to the new name.
      </p>
    </form>
  );
}
