"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FRAMEWORKS,
  FRAMEWORK_LABELS,
  type Framework,
} from "@/lib/agent-framework";

import {
  createFromChatAction,
  type ChatCreateFormState,
} from "./actions";

const DEFAULT_FRAMEWORK: Framework = "pydantic-agentspec";
const CHAT_INITIAL: ChatCreateFormState = {};

export function NewAgentForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, action, pending] = useActionState(
    createFromChatAction,
    CHAT_INITIAL,
  );
  // Cargo AI is an advanced option for porting existing assets; most
  // new agents go through Pydantic. Hide the framework picker behind
  // a small "Advanced" disclosure so the common case is name +
  // description and nothing else.
  const [advanced, setAdvanced] = useState(false);
  // Controlled inputs — React 19's useActionState resets uncontrolled
  // form fields after each submission completes, including the
  // returned-error path. Holding the values in state preserves the
  // user's input when the action returns an error and the form
  // re-renders.
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [framework, setFramework] = useState<Framework>(DEFAULT_FRAMEWORK);

  if (state.success) {
    const s = state.success;
    return (
      <div className="border-sentiment-positive bg-[var(--color-sentiment-positive-subtle)] flex flex-col gap-2 rounded-lg border p-4 text-sm">
        <span className="text-foreground font-semibold">
          PR requested for {s.agentName}
        </span>
        <p className="text-foreground-weak">
          Tembo is opening a pull request at{" "}
          <code className="bg-surface rounded px-1 py-0.5">{s.agentPath}</code>
          . You can watch the Tembo session, and the PR status will appear on
          the Improvements page once it&apos;s open.
        </p>
        <p className="text-foreground-weak text-xs">Status: {s.status}</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <a
            href={s.htmlUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground text-sm font-medium hover:underline"
          >
            View Tembo session ↗
          </a>
          <a
            href={`/${workspaceSlug}/improvements`}
            className="text-foreground-weak hover:text-foreground text-sm"
          >
            Open Improvements →
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      {/* Hidden framework field carries the controlled framework state
          when the picker is collapsed. When the picker is open the
          <select> below owns the field. */}
      {!advanced && (
        <input type="hidden" name="framework" value={framework} />
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="chat-name" className="text-sm">
          Agent name
        </Label>
        <Input
          id="chat-name"
          name="name"
          type="text"
          autoComplete="off"
          spellCheck={false}
          required
          minLength={2}
          maxLength={64}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          disabled={pending}
          placeholder="inbox-triage"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="text-foreground-muted text-sm">
          Lowercase letters, digits, and hyphens. Becomes the filename and
          the canonical agent name.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="chat-description" className="text-sm">
          What should the agent do?
        </Label>
        <textarea
          id="chat-description"
          name="description"
          required
          rows={8}
          disabled={pending}
          placeholder="Read incoming customer emails. Classify each one as billing, technical, or sales. Reply to billing emails with a link to the help center. Forward technical issues to the support inbox."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-input text-foreground-strong placeholder:text-foreground-weak hover:bg-input-hover focus:bg-input-active focus-visible:shadow-focus-ring disabled:bg-input-disabled disabled:text-foreground-muted flex w-full min-w-0 rounded-lg shadow-[0_0_0_1px_var(--color-border)] py-2 px-3 text-sm leading-6 focus:outline-none transition-[background-color,box-shadow,color] duration-150 disabled:cursor-not-allowed resize-y"
        />
        <p className="text-foreground-muted text-sm">
          Tembo will read this, write a new agent file in the canonical
          framework shape, and open a pull request for your team to review.
        </p>
      </div>

      {advanced ? (
        <div className="grid gap-1.5">
          <Label htmlFor="chat-framework" className="text-sm">
            Framework
          </Label>
          <select
            id="chat-framework"
            name="framework"
            value={framework}
            onChange={(e) => setFramework(e.target.value as Framework)}
            disabled={pending}
            className="bg-input text-foreground-strong hover:bg-input-hover focus:bg-input-active focus-visible:shadow-focus-ring disabled:bg-input-disabled flex h-7 w-full min-w-0 rounded-lg shadow-[0_0_0_1px_var(--color-border)] py-1 pr-1 pl-2 text-sm font-medium tracking-[-0.1px] focus:outline-none transition-[background-color,box-shadow,color] duration-150"
          >
            {FRAMEWORKS.map((f) => (
              <option key={f} value={f}>
                {FRAMEWORK_LABELS[f]}
              </option>
            ))}
          </select>
          <p className="text-foreground-muted text-sm">
            Default is Pydantic AgentSpec. Pick Cargo AI only when porting
            existing Cargo AI assets.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdvanced(true)}
          className="text-foreground-weak hover:text-foreground w-fit text-xs underline-offset-2 hover:underline"
        >
          Advanced: change framework
        </button>
      )}

      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        className="mt-1 w-fit"
      >
        {pending ? "Asking Tembo…" : "Create"}
      </Button>
    </form>
  );
}
