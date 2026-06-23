"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { cancelRunAction } from "./actions";

// Inline "Stop" control shown next to the status of a live (queued/running)
// run. Calls the cancel action, which flips the row to 'cancelled' and SIGKILLs
// the run's subprocess on the api. The page poller picks up the new status on
// its next refresh; we also refresh immediately on success.
export function CancelRunButton({
  workspaceSlug,
  agentName,
  runId,
}: {
  workspaceSlug: string;
  agentName: string;
  runId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await cancelRunAction({ workspaceSlug, agentName, runId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="small"
        variant="secondary"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? "Stopping…" : "Stop run"}
      </Button>
      {error && <span className="text-sentiment-negative text-xs">{error}</span>}
    </span>
  );
}
