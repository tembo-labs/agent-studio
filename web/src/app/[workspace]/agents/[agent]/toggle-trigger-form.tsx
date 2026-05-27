"use client";

import { useActionState } from "react";

import { toggleTriggerAction, type SimpleTriggerActionState } from "./actions";

const INITIAL: SimpleTriggerActionState = {};

// Flip-toggle as a tiny inline form. Same visual treatment as the
// Disconnect/Rename buttons elsewhere — plain text link, not a heavy
// button.
export function ToggleTriggerForm({
  workspaceSlug,
  id,
  nextEnabled,
}: {
  workspaceSlug: string;
  id: string;
  /** What the toggle will set the trigger to when clicked. */
  nextEnabled: boolean;
}) {
  const [, formAction, pending] = useActionState(toggleTriggerAction, INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="enabled" value={nextEnabled ? "true" : "false"} />
      <button
        type="submit"
        disabled={pending}
        className="text-foreground hover:text-foreground-strong text-sm font-medium hover:underline disabled:opacity-60"
      >
        {pending ? "…" : nextEnabled ? "Enable" : "Disable"}
      </button>
    </form>
  );
}
