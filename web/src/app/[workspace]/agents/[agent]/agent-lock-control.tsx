"use client";

// "Locked" control on the agent Settings tab (Workspace-Admin only). When on,
// the agent's in-app edit affordances (Chat to edit, Improve, Fork, learning
// capture) are removed and its Versions / Activity / Learning history tabs are
// hidden — it then changes only via direct repo PRs. Mirrors
// AgentLearningControl's useActionState + prop re-sync pattern.

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { useActionToast } from "@/lib/use-action-toast";

import { setAgentLockAction, type LockFormState } from "./actions";

const INITIAL: LockFormState = {};

type Props = {
  workspaceSlug: string;
  agentName: string;
  locked: boolean;
  canManage: boolean;
};

export function AgentLockControl({
  workspaceSlug,
  agentName,
  locked,
  canManage,
}: Props) {
  const [on, setOn] = useState(locked);
  // Re-sync to the server value after a save revalidates the page (render-phase
  // "adjust state on prop change"), so the checkbox doesn't look like it reverted.
  const [seen, setSeen] = useState(locked);
  if (seen !== locked) {
    setSeen(locked);
    setOn(locked);
  }
  const [state, formAction, pending] = useActionState(
    setAgentLockAction,
    INITIAL,
  );
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="agent" value={agentName} />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="locked"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          disabled={!canManage || pending}
          className="h-4 w-4"
        />
        <span className="text-foreground">Lock this agent</span>
      </label>

      <p className="text-foreground-muted max-w-prose text-xs leading-5">
        When locked, users can&apos;t change this agent in-app — Chat to edit,
        Improve, Fork, and correction/learning capture are all disabled, and the
        Versions, Activity, and Learning history tabs are hidden. The agent then
        changes only through direct repo PRs. Admin-only; changes are audited.
      </p>

      {canManage && (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </form>
  );
}
