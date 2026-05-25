"use client";

import { useRouter } from "next/navigation";
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

import {
  deleteAutomationAction,
  type DeleteAutomationFormState,
} from "../actions";

const INITIAL: DeleteAutomationFormState = {};

export function DeleteAutomationForm({
  workspaceSlug,
  id,
  name,
}: {
  workspaceSlug: string;
  id: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    deleteAutomationAction,
    INITIAL,
  );

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-foreground-weak text-sm">
        Deleting an automation removes the schedule. Past runs it produced
        are kept on the run history.
      </p>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={pending}>
            Delete automation
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this automation?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes{" "}
              <code className="bg-surface text-foreground rounded px-1 py-0.5 text-xs">
                {name}
              </code>
              . The agent file itself is untouched, and past runs stay in
              history.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {state.error && (
            <p className="text-sentiment-negative text-sm" role="alert">
              {state.error}
            </p>
          )}

          <AlertDialogFooter>
            <form
              action={(fd) => {
                formAction(fd);
                // Optimistically navigate away — the action's
                // revalidatePath will refresh the list when we land.
                router.push(`/${workspaceSlug}/automations`);
              }}
            >
              <input type="hidden" name="workspace" value={workspaceSlug} />
              <input type="hidden" name="id" value={id} />
              <AlertDialogAction asChild>
                <Button
                  type="submit"
                  variant="destructive"
                  size="big"
                  disabled={pending}
                >
                  {pending ? "Deleting…" : "Delete"}
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
    </div>
  );
}
