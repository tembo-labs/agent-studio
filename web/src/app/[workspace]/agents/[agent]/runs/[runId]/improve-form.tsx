"use client";

// "Improve the Agent" form on the run detail page. The user
// describes what should change in the agent; on submit we ask the
// Tembo Coding Agent Platform to open a session that produces a PR.
//
// Mode is a workspace-level setting — see Settings → Improvements
// delivery. Today there's only one supported mode (Always PR) so we
// don't re-display it here.

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { type Improvement } from "@/lib/improvements-api";

import { improveAgentAction, type ImproveResult } from "./actions";
import { ImprovementHistory } from "./improvement-history";

// Delay before the Improve section fades in once the run has
// settled. Gives the user a beat to read the output before the
// improvement affordance grabs attention.
const REVEAL_DELAY_MS = 2000;

export function ImproveForm({
  workspaceSlug,
  runId,
  improvements,
}: {
  workspaceSlug: string;
  runId: string;
  improvements: Improvement[];
}) {
  const router = useRouter();
  const [improvement, setImprovement] = useState("");
  const [result, setResult] = useState<ImproveResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const r = await improveAgentAction({
        workspaceSlug,
        runId,
        improvement,
      });
      setResult(r);
      if (r.ok) {
        setImprovement("");
        // Re-run the server component so the new improvement row
        // shows up in the inline history without a hard reload.
        router.refresh();
      }
    });
  };

  return (
    <div
      className={`transition-opacity duration-700 ease-out ${revealed ? "opacity-100" : "opacity-0"}`}
    >
    <Section title="Improve the Agent">
      <ImprovementHistory improvements={improvements} />
      <form
        onSubmit={handleSubmit}
        className={`flex flex-col gap-3 ${improvements.length > 0 ? "mt-4" : ""}`}
      >
        <p className="text-foreground-weak text-base">
          Describe what should change about this agent, and it will be
          submitted for approval.
        </p>

        <textarea
          value={improvement}
          onChange={(e) => setImprovement(e.target.value)}
          placeholder="The response was too long. Tighten the system prompt so answers stay under 3 sentences."
          rows={5}
          disabled={pending}
          className="bg-surface border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)] rounded-md border px-3 py-2 text-sm leading-6 resize-y"
        />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending || !improvement.trim()}>
            {pending ? "Asking Tembo…" : "Open a PR"}
          </Button>
          {pending && (
            <span className="text-foreground-weak text-sm">
              Creating a Tembo session — this may take a moment.
            </span>
          )}
        </div>

        {result && <ResultBanner result={result} />}
      </form>
    </Section>
    </div>
  );
}

function ResultBanner({ result }: { result: ImproveResult }) {
  if (result.ok) {
    return (
      <div className="border-sentiment-positive bg-[var(--color-sentiment-positive-subtle)] flex flex-col gap-1 rounded-lg border p-3 text-sm">
        <span className="text-foreground font-medium">
          Tembo Session created
        </span>
        <span className="text-foreground-weak text-sm">
          Status: {result.status}
        </span>
        <a
          href={result.htmlUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-foreground text-sm font-medium hover:underline"
        >
          View Session →
        </a>
      </div>
    );
  }

  return (
    <div className="border-sentiment-negative bg-[var(--color-input-error)] flex flex-col gap-1 rounded-lg border p-3 text-sm">
      <span className="text-sentiment-negative font-medium">
        Couldn&apos;t create the task
      </span>
      <span className="text-foreground whitespace-pre-wrap text-xs leading-5">
        {result.error}
      </span>
    </div>
  );
}
