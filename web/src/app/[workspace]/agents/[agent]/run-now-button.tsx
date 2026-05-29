"use client";

// "Run now" used to fire immediately with no input. Most agents
// benefit from a user message, so the button now opens a small
// dialog with a textarea before queueing the run. Empty input is
// still allowed — preserves the prior "exercise the agent's
// instructions only" behavior.

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

import { runNowAction, type RunNowFormState } from "./actions";

const INITIAL: RunNowFormState = {};

type Props = {
  workspaceSlug: string;
  agentName: string;
};

export function RunNowButton({ workspaceSlug, agentName }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(runNowAction, INITIAL);
  useActionToast(state);
  // Controlled — React 19's useActionState resets uncontrolled fields
  // after each submission, including the returned-error path. Reset
  // when the dialog closes so reopening starts fresh.
  const [userMessage, setUserMessage] = useState("");

  return (
    <div className="flex flex-col items-end gap-1">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setUserMessage("");
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="primary" disabled={pending}>
            {pending ? "Queueing…" : "Run now"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run {agentName}</AlertDialogTitle>
            <AlertDialogDescription>
              Optional message to pass to the agent as the user input. Leave
              blank to run the agent on its instructions alone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="workspace" value={workspaceSlug} />
            <input type="hidden" name="agent" value={agentName} />
            <textarea
              name="user_message"
              rows={5}
              disabled={pending}
              autoFocus
              placeholder="What should the agent do for this run?"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              className="bg-input text-foreground-strong placeholder:text-foreground-weak hover:bg-input-hover focus:bg-input-active focus-visible:shadow-focus-ring disabled:bg-input-disabled flex w-full min-w-0 rounded-lg shadow-[0_0_0_1px_var(--color-border)] py-2 px-3 text-sm leading-6 focus:outline-none transition-[background-color,box-shadow,color] duration-150 resize-y"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
            />
            <p className="text-foreground-weak text-sm">
              Cmd/Ctrl-Enter submits.
            </p>
            {state.error && (
              <p className="text-sentiment-negative text-sm" role="alert">
                {state.error}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="ghost" size="big" disabled={pending}>
                  Cancel
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  type="submit"
                  variant="primary"
                  size="big"
                  disabled={pending}
                >
                  {pending ? "Queueing…" : "Run"}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && (
        <p className="text-sentiment-negative max-w-xs text-right text-xs">
          {state.error}
        </p>
      )}
    </div>
  );
}
