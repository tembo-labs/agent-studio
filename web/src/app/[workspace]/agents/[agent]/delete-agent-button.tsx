"use client";

import { useActionState, useState } from "react";
import { useActionToast } from "@/lib/use-action-toast";

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

import { deleteAgentAction, type DeleteAgentFormState } from "./actions";

const INITIAL: DeleteAgentFormState = {};

type Props = {
  workspaceSlug: string;
  agentName: string;
};

export function DeleteAgentButton({ workspaceSlug, agentName }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    deleteAgentAction,
    INITIAL,
  );
  useActionToast(state);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={pending}>
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes{" "}
            <code className="bg-surface text-foreground rounded px-1 py-0.5 text-xs">
              {agentName}
            </code>{" "}
            from the connected repo on the default branch. The deletion is
            recorded so you can restore it from{" "}
            <strong className="text-foreground font-medium">Settings →
            Deleted agents</strong>
            .
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state.error && (
          <p className="text-sentiment-negative text-sm" role="alert">
            {state.error}
          </p>
        )}

        <AlertDialogFooter>
          <form action={formAction}>
            <input type="hidden" name="workspace" value={workspaceSlug} />
            <input type="hidden" name="agent" value={agentName} />
            <AlertDialogAction asChild>
              <Button
                type="submit"
                variant="destructive"
                size="big"
                disabled={pending}
              >
                {pending ? "Deleting…" : "Delete agent"}
              </Button>
            </AlertDialogAction>
          </form>
          <AlertDialogCancel asChild>
            <Button variant="ghost" size="big" disabled={pending}>
              Cancel
            </Button>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
