"use client";

// Shows the agent's owner and — for the owner or an admin — a small
// inline picker to (re)assign it. Owners are accountable for promoting
// the agent to Stable.

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { useActionToast } from "@/lib/use-action-toast";

import { setAgentOwnerAction, type OwnerFormState } from "./actions";

const INITIAL: OwnerFormState = {};

type Member = { userId: string; name: string | null; email: string };

type Props = {
  workspaceSlug: string;
  agentName: string;
  ownerUserId: string | null;
  ownerLabel: string | null;
  canAssign: boolean;
  members: Member[];
};

export function AgentOwnerControl({
  workspaceSlug,
  agentName,
  ownerUserId,
  ownerLabel,
  canAssign,
  members,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(ownerUserId ?? "");
  const [state, formAction, pending] = useActionState(
    setAgentOwnerAction,
    INITIAL,
  );
  useActionToast(state);

  if (editing && canAssign) {
    return (
      <form
        action={formAction}
        onSubmit={() => setEditing(false)}
        className="flex items-center gap-1.5"
      >
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <input type="hidden" name="agent" value={agentName} />
        <select
          name="owner_user_id"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={pending}
          className="bg-input text-foreground rounded-md px-2 py-1 text-sm shadow-[0_0_0_1px_var(--color-border)] focus:outline-none"
        >
          <option value="" disabled>
            Pick a member…
          </option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name ?? m.email}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="small" disabled={pending}>
          Save
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
      </form>
    );
  }

  return (
    <span className="text-foreground-muted inline-flex items-center gap-1.5 text-sm">
      <span>
        Owner:{" "}
        <span className="text-foreground-weak font-medium">
          {ownerLabel ?? "unassigned"}
        </span>
      </span>
      {canAssign && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-foreground-weak hover:text-foreground underline underline-offset-2"
        >
          {ownerUserId ? "Change" : "Assign"}
        </button>
      )}
    </span>
  );
}
