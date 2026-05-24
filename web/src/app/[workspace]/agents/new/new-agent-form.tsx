"use client";

import { useState, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  createFromContentAction,
  createFromTemplateAction,
  type NewAgentFormState,
} from "./actions";

const INITIAL: NewAgentFormState = {};

type Tab = "template" | "paste";

const SAMPLE_AGENTSPEC = `name: my-agent
model: anthropic:claude-sonnet-4-6
description: A short description of what this agent does.
instructions: |
  You are a helpful agent.
  Be concise.
`;

export function NewAgentForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [tab, setTab] = useState<Tab>("template");
  const [templateState, templateAction, templatePending] = useActionState(
    createFromTemplateAction,
    INITIAL,
  );
  const [contentState, contentAction, contentPending] = useActionState(
    createFromContentAction,
    INITIAL,
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        className="bg-surface border-border inline-flex w-fit gap-1 rounded-lg border p-1"
      >
        <TabButton active={tab === "template"} onClick={() => setTab("template")}>
          From template
        </TabButton>
        <TabButton active={tab === "paste"} onClick={() => setTab("paste")}>
          Paste AgentSpec
        </TabButton>
      </div>

      {tab === "template" ? (
        <form action={templateAction} className="flex flex-col gap-3">
          <input type="hidden" name="workspace" value={workspaceSlug} />
          <div className="grid gap-1.5">
            <Label htmlFor="name" className="text-sm">
              Agent name
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="off"
              spellCheck={false}
              required
              minLength={2}
              maxLength={64}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              disabled={templatePending}
              placeholder="hello-world"
            />
            <p className="text-foreground-muted text-xs">
              Lowercase letters, digits, and hyphens. Becomes the filename
              (e.g.{" "}
              <code className="bg-surface rounded px-1 py-0.5">
                agents/hello-world.yaml
              </code>
              ) and the canonical agent name.
            </p>
          </div>

          {templateState.error && (
            <p className="text-sentiment-negative text-sm" role="alert">
              {templateState.error}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={templatePending}
            className="mt-1 w-fit"
          >
            {templatePending ? "Committing…" : "Create agent"}
          </Button>
        </form>
      ) : (
        <form action={contentAction} className="flex flex-col gap-3">
          <input type="hidden" name="workspace" value={workspaceSlug} />

          <fieldset
            className="flex gap-3 text-sm"
            disabled={contentPending}
          >
            <legend className="text-foreground text-sm font-medium">
              Format
            </legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="format"
                value="yaml"
                defaultChecked
                className="accent-foreground"
              />
              YAML
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="format"
                value="json"
                className="accent-foreground"
              />
              JSON
            </label>
          </fieldset>

          <div className="grid gap-1.5">
            <Label htmlFor="content" className="text-sm">
              Pydantic AgentSpec definition
            </Label>
            <textarea
              id="content"
              name="content"
              required
              rows={14}
              spellCheck={false}
              disabled={contentPending}
              defaultValue={SAMPLE_AGENTSPEC}
              className="bg-input text-foreground-strong placeholder:text-foreground-weak hover:bg-input-hover focus:bg-input-active focus-visible:shadow-focus-ring disabled:bg-input-disabled disabled:text-foreground-muted flex w-full min-w-0 rounded-lg shadow-[0_0_0_1px_var(--color-border)] py-2 px-3 font-mono text-xs leading-5 focus:outline-none transition-[background-color,box-shadow,color] duration-150 disabled:cursor-not-allowed"
            />
            <p className="text-foreground-muted text-xs">
              Required fields:{" "}
              <code className="bg-surface rounded px-1 py-0.5">name</code>,{" "}
              <code className="bg-surface rounded px-1 py-0.5">model</code>,{" "}
              <code className="bg-surface rounded px-1 py-0.5">instructions</code>
              . Other AgentSpec fields pass through unchanged.
            </p>
          </div>

          {contentState.error && (
            <p className="text-sentiment-negative text-sm" role="alert">
              {contentState.error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={contentPending}
            className="mt-1 w-fit"
          >
            {contentPending ? "Committing…" : "Create agent"}
          </Button>
        </form>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "bg-surface-raised text-foreground rounded-md px-3 py-1 text-sm font-medium shadow-[0_1px_2px_0_rgba(0,0,0,0.08)]"
          : "text-foreground-weak hover:text-foreground rounded-md px-3 py-1 text-sm font-medium"
      }
    >
      {children}
    </button>
  );
}
