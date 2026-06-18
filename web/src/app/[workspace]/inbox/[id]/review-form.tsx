"use client";

// Review form for an inbox item. The textarea is pre-filled with the agent's
// proposed action; the human edits and submits. We never tell the human what
// the agent guessed beyond this prefill — the edit they make IS the signal the
// batched learning pass later uses to update the agent.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import {
  dismissInboxItemAction,
  submitInboxItemAction,
  type InboxActionResult,
} from "../actions";

export function ReviewForm({
  workspaceSlug,
  itemId,
  proposedText,
}: {
  workspaceSlug: string;
  itemId: string;
  proposedText: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(proposedText);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<InboxActionResult>) => {
    setError(null);
    startTransition(async () => {
      let r: InboxActionResult;
      try {
        r = await fn();
      } catch {
        setError(
          "Couldn't submit — this page may be out of date (a new version shipped). Refresh and try again.",
        );
        return;
      }
      if (r.ok) {
        router.push(`/${workspaceSlug}/inbox`);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
        Proposed action
      </h2>
      <p className="text-foreground-weak text-sm">
        {proposedText
          ? "The agent suggested this. Edit it to be right, then submit."
          : "The agent didn't propose anything — write the action to take, then submit."}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        disabled={pending}
        placeholder="The reply or decision to record…"
        className="bg-surface border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)] resize-y rounded-md border px-3 py-2 text-sm leading-6"
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={pending || !text.trim()}
          onClick={() =>
            run(() =>
              submitInboxItemAction({ workspaceSlug, itemId, text }),
            )
          }
        >
          {pending ? "Submitting…" : "Submit"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(() => dismissInboxItemAction({ workspaceSlug, itemId }))
          }
        >
          Dismiss
        </Button>
      </div>
      {error && (
        <div className="border-sentiment-negative bg-[var(--color-input-error)] rounded-lg border p-3 text-sm">
          <span className="text-foreground whitespace-pre-wrap leading-5">
            {error}
          </span>
        </div>
      )}
    </section>
  );
}
