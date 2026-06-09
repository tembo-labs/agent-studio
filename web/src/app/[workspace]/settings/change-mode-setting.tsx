"use client";

// Workspace-level "how do changes ship?" picker. Always PR opens a reviewable
// pull request; YOLO (direct-commit) lets the coding agent push straight to the
// default branch. The choice persists on the workspace (commit_mode) and is
// read at request time to shape the CAP prompt — see settings/actions.ts
// (setCommitModeAction) and lib/cap-api.ts (deliveryDirective).

import { useActionState } from "react";

import {
  COMMIT_MODE_LABELS,
  type CommitMode,
} from "@/lib/commit-mode-constants";
import { cn } from "@/lib/utils";

import { setCommitModeAction, type CommitModeState } from "./actions";

const INITIAL: CommitModeState = {};
const MODES: CommitMode[] = ["pull_request", "direct"];

export function ChangeModeSetting({
  workspaceSlug,
  current,
}: {
  workspaceSlug: string;
  current: CommitMode;
}) {
  const [state, formAction, pending] = useActionState(
    setCommitModeAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <div className="inline-flex w-fit rounded-lg border border-[var(--color-border-weak)] bg-surface-raised p-0.5">
        {MODES.map((mode) => {
          const active = current === mode;
          return (
            <button
              key={mode}
              type="submit"
              name="mode"
              value={mode}
              aria-pressed={active}
              disabled={pending}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-foreground-weak hover:text-foreground",
                pending && "cursor-wait opacity-60",
              )}
            >
              {COMMIT_MODE_LABELS[mode]}
            </button>
          );
        })}
      </div>

      <p className="text-foreground-weak text-sm">
        {current === "direct"
          ? "YOLO is on — the coding agent commits straight to your default branch with no PR. The default branch must accept direct pushes (no required-PR protection). Switch back to Always PR for review-gated changes."
          : "YOLO commits changes straight to the default branch with no PR. Only turn it on for trusted workspaces whose default branch accepts direct pushes."}
      </p>

      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="text-sentiment-positive text-sm" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
