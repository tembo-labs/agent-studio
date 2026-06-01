"use client";

// Workspace-level "how do changes ship?" picker. Always PR is the
// only working mode at v0.2-bootstrap; YOLO (direct-commit) is
// reserved for a later release and rendered disabled so the choice
// is visible but un-selectable. We deliberately don't persist
// anything yet — there's only one selectable value, so storage
// would just be ceremony. A workspace column lands when YOLO does.

import { cn } from "@/lib/utils";

export function ChangeModeSetting() {
  return (
    <div className="inline-flex w-fit rounded-lg border border-[var(--color-border-weak)] bg-surface-raised p-0.5">
      <button
        type="button"
        aria-pressed
        className="rounded-md bg-surface px-3 py-1.5 text-sm font-medium text-foreground shadow-sm"
      >
        Always PR
      </button>
      <button
        type="button"
        disabled
        aria-disabled
        title="YOLO mode lets a change land directly on the default branch — coming in a later release."
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium text-foreground-weak opacity-50 cursor-not-allowed",
          "flex items-center gap-1",
        )}
      >
        <span>YOLO</span>
        <span className="text-sm uppercase tracking-wide">soon</span>
      </button>
    </div>
  );
}
