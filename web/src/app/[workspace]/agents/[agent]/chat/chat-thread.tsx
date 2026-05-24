"use client";

// Chat-to-edit thread for an agent. Renders prior feedbacks as a
// chronological list of bubbles (user request on the right, the
// resulting Tembo task / PR status on the left), with a composer
// fixed to the bottom. New submissions create a feedback row with
// run_id=null and dispatch a Tembo task.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { feedbackSubmitterLabel } from "@/lib/feedback-display";
import { type Feedback, type FeedbackStatus } from "@/lib/feedbacks-api";
import { cn } from "@/lib/utils";

import { chatSubmitAction, type ChatSubmitResult } from "./actions";

export function ChatThread({
  workspaceSlug,
  agentName,
  feedbacks,
}: {
  workspaceSlug: string;
  agentName: string;
  feedbacks: Feedback[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      {feedbacks.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-4">
          {feedbacks.map((f) => (
            <ChatTurn
              key={f.id}
              feedback={f}
              workspaceSlug={workspaceSlug}
              agentName={agentName}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={handleSend}
        className="border-border bg-surface-raised flex flex-col gap-2 rounded-lg border p-3"
      >
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What would you like to change about this agent?"
          rows={3}
          disabled={pending}
          onKeyDown={(e) => {
            // Cmd/Ctrl-Enter submits, plain Enter inserts a newline.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement)?.requestSubmit();
            }
          }}
          className="bg-surface border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)] rounded-md border px-3 py-2 text-sm leading-6 resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground-weak text-xs">
            Cmd/Ctrl-Enter to send. A pull request will be opened for review.
          </span>
          <Button type="submit" disabled={pending || !message.trim()}>
            {pending ? "Sending…" : "Send"}
          </Button>
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
      No requests yet. Describe what you&apos;d like to change about this
      agent below — we&apos;ll open a pull request for review.
    </div>
  );
}

function ChatTurn({
  feedback,
  workspaceSlug,
  agentName,
}: {
  feedback: Feedback;
  workspaceSlug: string;
  agentName: string;
}) {
  const runHref = feedback.runId
    ? `/${workspaceSlug}/agents/${encodeURIComponent(agentName)}/runs/${feedback.runId}`
    : null;
  return (
    <li className="flex flex-col gap-2">
      {/* User request bubble — right-aligned. */}
      <div className="flex justify-end">
        <div className="bg-interactive text-foreground-on-accent flex max-w-[80%] flex-col gap-1 rounded-lg px-3 py-2">
          <p className="whitespace-pre-wrap text-sm leading-5">
            {feedback.feedbackText}
          </p>
          <span className="text-foreground-on-accent/70 text-[10px]">
            {feedbackSubmitterLabel(feedback)} ·{" "}
            <LocalTime iso={feedback.createdAt.toISOString()} />
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

      {/* Tembo / system response bubble — left-aligned. */}
      <div className="flex justify-start">
        <div
          className={cn(
            "border-border bg-surface-raised flex max-w-[80%] flex-col gap-1.5 rounded-lg border px-3 py-2",
          )}
        >
          <div className="flex items-center gap-2">
            <StatusBadge status={feedback.status} />
            {feedback.prNumber && feedback.prUrl && (
              <a
                href={feedback.prUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground text-xs font-medium hover:underline"
              >
                PR #{feedback.prNumber} ↗
              </a>
            )}
            {feedback.temboTaskHtmlUrl && (
              <a
                href={feedback.temboTaskHtmlUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground-weak text-xs hover:underline"
              >
                Tembo task ↗
              </a>
            )}
          </div>
          <p className="text-foreground-weak text-xs leading-5">
            {statusBlurb(feedback.status)}
          </p>
        </div>
      </div>
    </li>
  );
}

function statusBlurb(status: FeedbackStatus): string {
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

function StatusBadge({ status }: { status: FeedbackStatus }) {
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
