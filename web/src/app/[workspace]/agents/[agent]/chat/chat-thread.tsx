"use client";

// Chat-to-edit thread for an agent.
//
// Two distinct intents share a single composer:
//
//   "Send to agent"        → runs the agent with the typed message
//                             so the user can probe its behavior
//                             before deciding what to change.
//                             Cheap, frequent. Creates a Run row.
//
//   "Submit change request" → packages the message and ships it to
//                             Tembo as a task → opens a PR for
//                             review. Slow, rare. Creates an
//                             improvement row tied to the agent
//                             (run_id=null).
//
// The thread renders runs (conversation turns) and improvements
// (change requests) interleaved chronologically. Any in-flight run
// (queued / running) triggers an auto-refresh so the agent's reply
// lands without the user reloading.

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { improvementSubmitterLabel } from "@/lib/improvement-display";
import {
  type Improvement,
  type ImprovementStatus,
} from "@/lib/improvements-api";
import { type ChatRun } from "@/lib/runs-db";
import { cn } from "@/lib/utils";

import {
  chatSubmitAction,
  sendToAgentAction,
  type ChatSubmitResult,
  type SendToAgentResult,
} from "./actions";

export type ChatTurn =
  | { kind: "run"; createdAt: Date; run: ChatRun }
  | { kind: "improvement"; createdAt: Date; improvement: Improvement };

export function ChatThread({
  workspaceSlug,
  agentName,
  turns,
}: {
  workspaceSlug: string;
  agentName: string;
  turns: ChatTurn[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Auto-refresh while any run is in flight so the agent's reply
  // shows up without the user reloading. Cleared as soon as
  // everything has settled.
  const hasInFlight = turns.some(
    (t) => t.kind === "run" && (t.run.status === "queued" || t.run.status === "running"),
  );
  useEffect(() => {
    if (!hasInFlight) return;
    const id = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(id);
  }, [hasInFlight, router]);

  const onSendToAgent = () => {
    setError(null);
    startTransition(async () => {
      const r: SendToAgentResult = await sendToAgentAction({
        workspaceSlug,
        agentName,
        message,
      });
      if (r.ok) {
        setMessage("");
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  };

  const onSubmitChange = () => {
    setError(null);
    startTransition(async () => {
      const r: ChatSubmitResult = await chatSubmitAction({
        workspaceSlug,
        agentName,
        message,
      });
      if (r.ok) {
        setMessage("");
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {turns.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-4">
          {turns.map((t) =>
            t.kind === "run" ? (
              <RunBubble
                key={`r:${t.run.id}`}
                run={t.run}
              />
            ) : (
              <ImprovementBubble
                key={`i:${t.improvement.id}`}
                improvement={t.improvement}
                workspaceSlug={workspaceSlug}
                agentName={agentName}
              />
            ),
          )}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSendToAgent();
        }}
        className="border-border bg-surface-raised flex flex-col gap-2 rounded-lg border p-3"
      >
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Talk to the agent, or describe a change you'd like to make…"
          rows={3}
          disabled={pending}
          onKeyDown={(e) => {
            // Cmd/Ctrl-Enter = Send to agent (the default action).
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSendToAgent();
            }
          }}
          className="bg-surface border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)] rounded-md border px-3 py-2 text-sm leading-6 resize-y"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-foreground-weak text-sm">
            Cmd/Ctrl-Enter sends to the agent. Submit a change to open a PR
            for review.
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onSubmitChange}
              disabled={pending || !message.trim()}
            >
              Submit change
            </Button>
            <Button
              type="submit"
              disabled={pending || !message.trim()}
            >
              {pending ? "Sending…" : "Send to agent"}
            </Button>
          </div>
        </div>
        {error && (
          <div className="border-sentiment-negative bg-[var(--color-input-error)] flex flex-col gap-1 rounded-lg border p-3 text-sm">
            <span className="text-sentiment-negative font-medium">
              Couldn&apos;t send
            </span>
            <span className="text-foreground whitespace-pre-wrap text-xs leading-5">
              {error}
            </span>
          </div>
        )}
      </form>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border-weak)] bg-surface-raised px-4 py-6 text-center text-sm">
      Talk to the agent, or describe a change you&apos;d like to make. Each
      change request opens a pull request for review.
    </div>
  );
}

function RunBubble({ run }: { run: ChatRun }) {
  return (
    <li className="flex flex-col gap-2">
      {/* User message — right-aligned. */}
      <div className="flex justify-end">
        <div className="bg-interactive text-foreground-on-accent flex max-w-[80%] flex-col gap-1 rounded-lg px-3 py-2">
          <p className="whitespace-pre-wrap text-sm leading-5">
            {run.userMessage}
          </p>
          <span className="text-foreground-on-accent/70 text-xs">
            <LocalTime iso={run.createdAt.toISOString()} />
          </span>
        </div>
      </div>

      {/* Agent reply — left-aligned. Shows a pending state while
          the run is in flight; renders the output once it lands. */}
      <div className="flex justify-start">
        <div className="border-border bg-surface-raised flex max-w-[80%] flex-col gap-1 rounded-lg border px-3 py-2">
          {run.status === "queued" || run.status === "running" ? (
            <p className="text-foreground-weak text-base italic">
              {run.status === "queued" ? "Queued…" : "Thinking…"}
            </p>
          ) : run.status === "failed" ? (
            <p className="text-sentiment-negative whitespace-pre-wrap text-sm leading-5">
              {run.errorMessage ?? "Run failed."}
            </p>
          ) : (
            <p className="text-foreground whitespace-pre-wrap text-sm leading-5">
              {stripStopReason(run.output)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function ImprovementBubble({
  improvement,
  workspaceSlug,
  agentName,
}: {
  improvement: Improvement;
  workspaceSlug: string;
  agentName: string;
}) {
  const runHref = improvement.runId
    ? `/${workspaceSlug}/agents/${encodeURIComponent(agentName)}/runs/${improvement.runId}`
    : null;
  return (
    <li className="flex flex-col gap-2">
      {/* User change request — right-aligned, with a label badge so
          it visually reads as different from a normal chat turn. */}
      <div className="flex justify-end">
        <div className="bg-interactive text-foreground-on-accent flex max-w-[80%] flex-col gap-1 rounded-lg px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground-on-accent/80 text-xs uppercase tracking-wide">
              Change request
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-5">
            {improvement.improvementText}
          </p>
          <span className="text-foreground-on-accent/70 text-xs">
            {improvementSubmitterLabel(improvement)} ·{" "}
            <LocalTime iso={improvement.createdAt.toISOString()} />
            {runHref && (
              <>
                {" · "}
                <a href={runHref} className="underline">
                  from run
                </a>
              </>
            )}
          </span>
        </div>
      </div>

      {/* PR / Tembo status reply — left-aligned. */}
      <div className="flex justify-start">
        <div
          className={cn(
            "border-border bg-surface-raised flex max-w-[80%] flex-col gap-1.5 rounded-lg border px-3 py-2",
          )}
        >
          <div className="flex items-center gap-2">
            <StatusBadge status={improvement.status} />
            {improvement.prNumber && improvement.prUrl && (
              <a
                href={improvement.prUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground text-xs font-medium hover:underline"
              >
                PR #{improvement.prNumber} ↗
              </a>
            )}
            {improvement.temboTaskHtmlUrl && (
              <a
                href={improvement.temboTaskHtmlUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground-weak text-sm hover:underline"
              >
                Tembo Session ↗
              </a>
            )}
          </div>
          <p className="text-foreground-weak text-sm leading-5">
            {statusBlurb(improvement.status)}
          </p>
        </div>
      </div>
    </li>
  );
}

function statusBlurb(status: ImprovementStatus): string {
  switch (status) {
    case "submitted":
      return "Sent to Tembo. Waiting for the coding agent to open a PR.";
    case "pr_opened":
      return "Pull request is open and ready for review.";
    case "merged":
      return "Pull request was merged — the change is live on the default branch.";
    case "closed":
      return "Pull request was closed without merging.";
  }
}

function StatusBadge({ status }: { status: ImprovementStatus }) {
  switch (status) {
    case "submitted":
      return (
        <Badge variant="gray" size="small">
          Submitted
        </Badge>
      );
    case "pr_opened":
      return (
        <Badge variant="blue" size="small">
          PR opened
        </Badge>
      );
    case "merged":
      return (
        <Badge variant="green" size="small">
          Merged
        </Badge>
      );
    case "closed":
      return (
        <Badge variant="red" size="small">
          Closed
        </Badge>
      );
  }
}

// Pre-088a1d1 runs were stored with a "[stop_reason=...]" suffix.
// Strip it on read so historical chat turns render cleanly.
function stripStopReason(output: string): string {
  return output.replace(/\n*\[stop_reason=[^\]]*\]\s*$/, "");
}
