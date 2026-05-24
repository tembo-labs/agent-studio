"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { runNowAction, type RunNowFormState } from "./actions";

const INITIAL: RunNowFormState = {};

type Props = {
  workspaceSlug: string;
  agentName: string;
};

export function RunNowButton({ workspaceSlug, agentName }: Props) {
  const [state, formAction, pending] = useActionState(runNowAction, INITIAL);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <input type="hidden" name="agent" value={agentName} />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Queueing…" : "Run now"}
        </Button>
      </form>
      {state.error && (
        <p className="text-sentiment-negative max-w-xs text-right text-xs">
          {state.error}
        </p>
      )}
    </div>
  );
}
