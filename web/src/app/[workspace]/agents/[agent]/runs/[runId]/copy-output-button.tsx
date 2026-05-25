"use client";

// Tiny copy-to-clipboard control rendered in the top-right of the
// run output. Lives next to the output `<pre>` so the user can lift
// the agent's reply into Slack / email / a doc without doing a
// select-all dance. Flips to a "Copied" affordance for ~1.5s after
// success and shows an inline error if the clipboard call rejects
// (rare — usually permissions in an insecure context).

import { IconCheckmark1, IconClipboard } from "central-icons";
import { useState } from "react";

const FEEDBACK_MS = 1500;

export function CopyOutputButton({ text }: { text: string }) {
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

  const label =
    state === "copied" ? "Copied" : state === "error" ? "Copy failed" : "Copy";

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy output to clipboard"
      title={label}
      className="bg-surface text-foreground-weak hover:text-foreground hover:bg-surface-raised border-border inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs shadow-sm transition-colors"
    >
      {state === "copied" ? (
        <IconCheckmark1 size={14} />
      ) : (
        <IconClipboard size={14} />
      )}
      <span>{label}</span>
    </button>
  );
}
