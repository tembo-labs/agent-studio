"use client";

// "Promote to Stable" — snapshots the current draft as the next numbered
// version and makes it the default everything runs. Gated to the agent's
// owner or a workspace admin; warns an admin who isn't the owner. Disabled
// when the draft has no changes vs the current stable version.

import { useActionState, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/lib/use-action-toast";

import { promoteAgentAction, type PromoteFormState } from "./actions";

const INITIAL: PromoteFormState = {};

type Props = {
  workspaceSlug: string;
  agentName: string;
  /** v(N+1) that this promotion will create. */
  nextVersion: number;
  /** Draft differs from the current stable version (or no stable yet). */
  hasChanges: boolean;
  /** Acting user is the agent's owner. */
  isOwner: boolean;
  /** Display name of the owner, when one is set. */
  ownerLabel: string | null;
};

export function PromoteButton({
  workspaceSlug,
  agentName,
  nextVersion,
  hasChanges,
  isOwner,
  ownerLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    promoteAgentAction,
    INITIAL,
  );
  useActionToast(state);

  if (!hasChanges) {
    return (
      <Button variant="secondary" disabled title="No unreleased changes">
        No changes to promote
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="primary" disabled={pending}>
          {pending ? "Promoting…" : `Promote to Stable (v${nextVersion})`}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Promote {agentName} to Stable v{nextVersion}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This snapshots the current draft as v{nextVersion} and makes it the
            version everything runs by default (scheduled runs, Slack,
            webhooks). The draft stays editable for the next version.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!isOwner && ownerLabel && (
          <p className="text-[var(--color-sentiment-caution)] text-sm">
            You&apos;re not the owner of this agent ({ownerLabel}). Ideally the
            owner promotes — continue only if you&apos;re sure.
          </p>
        )}
        {state.error && (
          <p className="text-sentiment-negative text-sm" role="alert">
            {state.error}
          </p>
        )}

        <form action={formAction}>
          <input type="hidden" name="workspace" value={workspaceSlug} />
          <input type="hidden" name="agent" value={agentName} />
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="ghost" size="big" disabled={pending}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="submit" variant="primary" size="big" disabled={pending}>
                {pending ? "Promoting…" : "Promote"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
