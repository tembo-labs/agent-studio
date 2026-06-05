"use client";

// Shown when the live draft differs from the current stable version. On
// demand (button) it fetches an LLM summary + a line diff of stable -> draft
// so the owner can see what a promotion would release.

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { summarizeDraftAction, type DraftChangesResult } from "./actions";

type Props = {
  workspaceSlug: string;
  agentName: string;
};

export function DraftChangesBanner({ workspaceSlug, agentName }: Props) {
  const [result, setResult] = useState<DraftChangesResult | null>(null);
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      setResult(await summarizeDraftAction({ workspaceSlug, agentName }));
    });
  };

  return (
    <div className="rounded-lg border border-[var(--color-sentiment-caution)] bg-[var(--color-sentiment-caution-subtle)] px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-foreground">
          The draft has changes not yet released to Stable.
        </span>
        {result === null && (
          <Button
            type="button"
            variant="secondary"
            size="small"
            disabled={pending}
            onClick={load}
          >
            {pending ? "Summarizing…" : "View changes"}
          </Button>
        )}
      </div>

      {result && !result.ok && (
        <p className="text-sentiment-negative mt-2">{result.error}</p>
      )}

      {result && result.ok && (
        <div className="mt-3 flex flex-col gap-3">
          {result.invalid && (
            <p className="text-sentiment-negative">
              The draft file is currently invalid — fix it before promoting.
            </p>
          )}
          <div className="text-foreground whitespace-pre-wrap">
            {result.summary}
          </div>
          <details className="group">
            <summary className="text-foreground-weak hover:text-foreground cursor-pointer select-none underline underline-offset-2">
              Show diff (+{result.diff.stats.added} −{result.diff.stats.removed})
            </summary>
            <pre className="bg-surface border-border mt-2 overflow-x-auto rounded-lg border p-3 font-mono text-xs leading-5">
              {result.diff.lines.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.type === "add"
                      ? "text-sentiment-positive"
                      : l.type === "remove"
                        ? "text-sentiment-negative"
                        : "text-foreground-muted"
                  }
                >
                  {l.type === "add" ? "+ " : l.type === "remove" ? "- " : "  "}
                  {l.text}
                </div>
              ))}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
