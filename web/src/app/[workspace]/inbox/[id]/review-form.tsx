"use client";

// Review UI for an inbox item. Two modes:
//  - Action menu: when the item carries `options`, render a button per option
//    (recommended first). A "reply" option shows an editable textarea prefilled
//    with the agent's draft + a "Send" button; "oneclick" options are one tap.
//    Clicking runs executeInboxOptionAction, which performs the action (e.g.
//    archive/send on LinkedIn) and resolves the item.
//  - Free text: legacy single-textarea Submit/Dismiss for items with no menu.
// What you pick / edit vs. the agent's recommendation is the learning signal.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { InboxOption } from "@/lib/inbox-api";

import {
  dismissInboxItemAction,
  executeInboxOptionAction,
  submitInboxItemAction,
  type InboxActionResult,
} from "../actions";

/** Friendly confirmation copy per option, by what it does. */
function successFor(opt: InboxOption): string {
  switch (opt.execute?.op) {
    case "send_and_archive":
      return "Reply sent and archived";
    case "send":
      return "Reply sent";
    case "archive":
      return "Archived";
    default:
      return `${opt.label} done`;
  }
}

export function ReviewForm({
  workspaceSlug,
  itemId,
  proposedText,
  options,
}: {
  workspaceSlug: string;
  itemId: string;
  proposedText: string;
  options?: InboxOption[] | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const run = (
    key: string,
    fn: () => Promise<InboxActionResult>,
    successMsg?: string,
  ) => {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      let r: InboxActionResult;
      try {
        r = await fn();
      } catch {
        setBusy(null);
        setError(
          "Couldn't submit — this page may be out of date (a new version shipped). Refresh and try again.",
        );
        return;
      }
      if (r.ok) {
        // Confirm, then navigate to the inbox. (No router.refresh() — calling it
        // right after push races and re-renders this page instead of landing on
        // the list. force-dynamic on /inbox gives fresh data on navigation.)
        toast.success(successMsg ?? "Done");
        router.push(`/${workspaceSlug}/inbox`);
      } else {
        setBusy(null);
        setError(r.error);
      }
    });
  };

  if (options && options.length > 0) {
    return (
      <ActionMenu
        workspaceSlug={workspaceSlug}
        itemId={itemId}
        options={options}
        pending={pending}
        busy={busy}
        error={error}
        run={run}
      />
    );
  }

  return (
    <FreeTextForm
      workspaceSlug={workspaceSlug}
      itemId={itemId}
      proposedText={proposedText}
      pending={pending}
      busy={busy}
      error={error}
      run={run}
    />
  );
}

function ActionMenu({
  workspaceSlug,
  itemId,
  options,
  pending,
  busy,
  error,
  run,
}: {
  workspaceSlug: string;
  itemId: string;
  options: InboxOption[];
  pending: boolean;
  busy: string | null;
  error: string | null;
  run: (
    key: string,
    fn: () => Promise<InboxActionResult>,
    successMsg?: string,
  ) => void;
}) {
  // Reply options share ONE editable draft (e.g. "Send" + "Send + Archive");
  // one-click options (Archive / Ignore) are plain buttons. Recommended first.
  const byRec = (a: InboxOption, b: InboxOption) =>
    (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0);
  const replyOpts = options.filter((o) => o.kind === "reply").sort(byRec);
  const clickOpts = options.filter((o) => o.kind === "oneclick").sort(byRec);
  const [draft, setDraft] = useState(replyOpts.find((o) => o.draft)?.draft ?? "");

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
        What do you want to do?
      </h2>

      {replyOpts.length > 0 && (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            disabled={pending}
            placeholder="The reply to send…"
            className="bg-surface border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)] resize-y rounded-md border px-3 py-2 text-sm leading-6"
          />
          <div className="flex flex-wrap gap-2">
            {replyOpts.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                variant={opt.recommended ? "primary" : "secondary"}
                disabled={pending || !draft.trim()}
                onClick={() =>
                  run(
                    opt.id,
                    () =>
                      executeInboxOptionAction({
                        workspaceSlug,
                        itemId,
                        optionId: opt.id,
                        text: draft,
                      }),
                    successFor(opt),
                  )
                }
              >
                {busy === opt.id ? "Sending…" : opt.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {clickOpts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {clickOpts.map((opt) => (
            <Button
              key={opt.id}
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(
                  opt.id,
                  () =>
                    executeInboxOptionAction({
                      workspaceSlug,
                      itemId,
                      optionId: opt.id,
                    }),
                  successFor(opt),
                )
              }
            >
              {busy === opt.id ? "Working…" : opt.label}
            </Button>
          ))}
        </div>
      )}

      {error && <ErrorBanner error={error} />}
    </section>
  );
}

function FreeTextForm({
  workspaceSlug,
  itemId,
  proposedText,
  pending,
  busy,
  error,
  run,
}: {
  workspaceSlug: string;
  itemId: string;
  proposedText: string;
  pending: boolean;
  busy: string | null;
  error: string | null;
  run: (
    key: string,
    fn: () => Promise<InboxActionResult>,
    successMsg?: string,
  ) => void;
}) {
  const [text, setText] = useState(proposedText);
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
            run(
              "submit",
              () => submitInboxItemAction({ workspaceSlug, itemId, text }),
              "Saved",
            )
          }
        >
          {busy === "submit" ? "Submitting…" : "Submit"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(
              "dismiss",
              () => dismissInboxItemAction({ workspaceSlug, itemId }),
              "Dismissed",
            )
          }
        >
          Dismiss
        </Button>
      </div>
      {error && <ErrorBanner error={error} />}
    </section>
  );
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="border-sentiment-negative bg-[var(--color-input-error)] rounded-lg border p-3 text-sm">
      <span className="text-foreground whitespace-pre-wrap leading-5">{error}</span>
    </div>
  );
}
