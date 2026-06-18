"use client";

// Learning-mode control on the agent Settings tab. When on, the scheduler's
// learning pass periodically batches the corrections you made to this agent's
// Inbox proposals into one Tembo PR (cadence-gated), so the agent handles more
// on its own over time. Mirrors AgentOwnerControl's useActionState pattern.

import { useActionState, useState } from "react";

import { LocalTime } from "@/components/local-time";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/lib/use-action-toast";

import { setAgentLearningAction, type LearningFormState } from "./actions";

const INITIAL: LearningFormState = {};

type Props = {
  workspaceSlug: string;
  agentName: string;
  enabled: boolean;
  cadence: "daily" | "weekly";
  canEdit: boolean;
  lastLearnedAtIso: string | null;
};

export function AgentLearningControl({
  workspaceSlug,
  agentName,
  enabled,
  cadence,
  canEdit,
  lastLearnedAtIso,
}: Props) {
  const [on, setOn] = useState(enabled);
  const [cad, setCad] = useState<"daily" | "weekly">(cadence);
  const [state, formAction, pending] = useActionState(
    setAgentLearningAction,
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
          name="enabled"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          disabled={!canEdit || pending}
          className="h-4 w-4"
        />
        <span className="text-foreground">Learn from my Inbox corrections</span>
      </label>

      <label className="text-foreground-weak flex items-center gap-2 text-sm">
        <span>Refresh cadence</span>
        <select
          name="cadence"
          value={cad}
          onChange={(e) => setCad(e.target.value as "daily" | "weekly")}
          disabled={!canEdit || pending || !on}
          className="bg-input text-foreground rounded-md px-2 py-1 text-sm shadow-[0_0_0_1px_var(--color-border)] focus:outline-none"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>

      {lastLearnedAtIso && (
        <p className="text-foreground-muted text-xs">
          Last learned: <LocalTime iso={lastLearnedAtIso} style="relative" />
        </p>
      )}

      {canEdit && (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </form>
  );
}
