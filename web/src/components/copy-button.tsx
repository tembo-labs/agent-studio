"use client";

// Reusable copy-to-clipboard control. Same affordance the run-output copy
// button uses (icon + label, flips to "Copied" for ~1.5s, inline error if
// the clipboard call rejects — rare, usually an insecure context). Used
// wherever the app hands the user a blob to lift elsewhere (run output,
// the Slack app manifest, …).

import { IconCheckmark1, IconClipboard } from "central-icons";
import { useState } from "react";

const FEEDBACK_MS = 1500;

export function CopyButton({
  text,
  label = "Copy",
  ariaLabel = "Copy to clipboard",
  className,
}: {
  text: string;
  /** Idle-state label. Becomes "Copied" / "Copy failed" transiently. */
  label?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      window.setTimeout(() => setState("idle"), FEEDBACK_MS);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), FEEDBACK_MS);
    }
  };

  const shown =
    state === "copied" ? "Copied" : state === "error" ? "Copy failed" : label;

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel}
      title={shown}
      className={
        className ??
        "bg-surface text-foreground-weak hover:text-foreground hover:bg-surface-raised border-border inline-flex h-7 items-center gap-1 rounded-md border px-2 text-sm shadow-sm transition-colors"
      }
    >
      {state === "copied" ? (
        <IconCheckmark1 size={14} />
      ) : (
        <IconClipboard size={14} />
      )}
      <span>{shown}</span>
    </button>
  );
}
