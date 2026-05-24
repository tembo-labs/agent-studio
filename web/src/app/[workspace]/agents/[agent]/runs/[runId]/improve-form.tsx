"use client";

// "Improve me" feedback form on the run detail page. The user
// describes what should change in the agent; on submit we ask the
// Tembo Coding Agent Platform to open a session that produces a PR.
//
// Mode picker has two slots: "Always PR" (the only working mode at
// v0.2-bootstrap) and "YOLO" (placeholder for direct-commit, coming
// later). YOLO is rendered disabled so the affordance is visible
// but the user can't pick it.

import { useState, useTransition } from "react";

import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { improveAgentAction, type ImproveResult } from "./actions";

type Mode = "always_pr" | "yolo";

export function ImproveForm({
  workspaceSlug,
  runId,
}: {
  workspaceSlug: string;
  runId: string;
}) {
  const [feedback, setFeedback] = useState("");
  const [mode, setMode] = useState<Mode>("always_pr");
  const [result, setResult] = useState<ImproveResult | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (mode !== "always_pr") return;
    setResult(null);
    startTransition(async () => {
      const r = await improveAgentAction({ workspaceSlug, runId, feedback });
      setResult(r);
      if (r.ok) {
        setFeedback("");
      }
    });
  };

  return (
    <Section title="Improve me">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-foreground-weak text-sm">
          Describe what should change about this agent. We&apos;ll ask the{" "}
          <a
            href="https://docs.tembo.io/api/create-session"
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground hover:underline"
          >
            Tembo Coding Agent Platform
          </a>{" "}
          to open a pull request against your connected repo with the change.
        </p>

        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="The response was too long. Tighten the system prompt so answers stay under 3 sentences."
          rows={5}
          disabled={pending}
          className="bg-surface border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)] rounded-md border px-3 py-2 text-sm leading-6 resize-y"
        />

        <ModePicker value={mode} onChange={setMode} />

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={pending || !feedback.trim() || mode !== "always_pr"}
          >
            {pending ? "Asking Tembo…" : "Open a PR"}
          </Button>
          {pending && (
            <span className="text-foreground-weak text-xs">
              Creating a Tembo session — this may take a moment.
            </span>
          )}
        </div>

        {result && <ResultBanner result={result} />}
      </form>
    </Section>
  );
}

function ModePicker({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-foreground-weak text-xs font-medium">Mode</span>
      <div className="inline-flex w-fit rounded-lg border border-[var(--color-border-weak)] bg-surface-raised p-0.5">
        <button
          type="button"
          onClick={() => onChange("always_pr")}
          aria-pressed={value === "always_pr"}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === "always_pr"
              ? "bg-surface text-foreground shadow-sm"
              : "text-foreground-weak hover:text-foreground",
          )}
        >
          Always PR
        </button>
        <button
          type="button"
          disabled
          aria-disabled
          title="YOLO mode lets a change land directly on the default branch — coming in a later release."
          className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground-weak opacity-50 cursor-not-allowed"
        >
          YOLO <span className="text-[10px] uppercase tracking-wide">soon</span>
        </button>
      </div>
    </div>
  );
}

function ResultBanner({ result }: { result: ImproveResult }) {
  if (result.ok) {
    return (
      <div className="border-sentiment-positive bg-[var(--color-sentiment-positive-subtle)] flex flex-col gap-1 rounded-lg border p-3 text-sm">
        <span className="text-foreground font-medium">
          Tembo session created
        </span>
        <span className="text-foreground-weak text-xs">
          Status: {result.status}
        </span>
        <a
          href={result.htmlUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-foreground text-sm font-medium hover:underline"
        >
          View session →
        </a>
      </div>
    );
  }

  return (
    <div className="border-sentiment-negative bg-[var(--color-input-error)] flex flex-col gap-1 rounded-lg border p-3 text-sm">
      <span className="text-sentiment-negative font-medium">
        Couldn&apos;t create the session
      </span>
      <span className="text-foreground whitespace-pre-wrap text-xs leading-5">
        {result.error}
      </span>
    </div>
  );
}
