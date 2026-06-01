"use client";

import { useActionState, useState } from "react";
import { useActionToast } from "@/lib/use-action-toast";

import { Button } from "@/components/ui/button";

import { createTriggerAction, type TriggerFormState } from "./actions";

const INITIAL: TriggerFormState = {};

type ConnectionChoice = {
  id: string;
  toolkit: string;
  name: string;
  /** Pre-formatted label, e.g. "Gmail · work". */
  label: string;
};

type Props = {
  workspaceSlug: string;
  agentName: string;
  connections: ConnectionChoice[];
  /** Disabled when prerequisites aren't met (no Composio API key). */
  disabled?: boolean;
};

export function TriggerForm({
  workspaceSlug,
  agentName,
  connections,
  disabled,
}: Props) {
  const [state, formAction, pending] = useActionState(
    createTriggerAction,
    INITIAL,
  );
  useActionToast(state);
  // Controlled inputs — React 19's useActionState resets uncontrolled
  // fields on each submit, including the error path. We also reset
  // them ourselves after a successful submit (empty state object).
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [triggerType, setTriggerType] = useState("");
  const [config, setConfig] = useState("{}");
  const [expanded, setExpanded] = useState(false);

  if (connections.length === 0) {
    return (
      <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-3 text-sm">
        Authorize a connection on the{" "}
        <a
          href={`/${workspaceSlug}/connections`}
          className="text-foreground underline underline-offset-2"
        >
          Connections page
        </a>{" "}
        first — triggers fire under a specific user&apos;s credentials.
      </p>
    );
  }

  if (!expanded) {
    return (
      <Button
        variant="secondary"
        onClick={() => setExpanded(true)}
        disabled={disabled}
      >
        Add trigger
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-surface border-border flex flex-col gap-3 rounded-lg border p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-foreground-title text-sm font-semibold">
          New trigger
        </h3>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          disabled={pending}
          className="text-foreground-weak hover:text-foreground text-sm hover:underline"
        >
          Cancel
        </button>
      </div>
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="agent" value={agentName} />

      <label className="flex flex-col gap-1">
        <span className="text-foreground text-sm font-medium">Connection</span>
        <select
          name="connection_id"
          value={connectionId}
          onChange={(e) => setConnectionId(e.target.value)}
          disabled={pending}
          className="bg-input text-foreground-strong hover:bg-input-hover focus:bg-input-active focus-visible:shadow-focus-ring disabled:bg-input-disabled rounded-lg shadow-[0_0_0_1px_var(--color-border)] py-2 px-3 text-sm focus:outline-none transition-[background-color,box-shadow,color] duration-150"
        >
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.connection && (
          <span className="text-sentiment-negative text-sm">
            {state.fieldErrors.connection}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-foreground text-sm font-medium">
          Composio trigger slug
        </span>
        <input
          name="trigger_type"
          value={triggerType}
          onChange={(e) => setTriggerType(e.target.value)}
          disabled={pending}
          placeholder="GMAIL_NEW_GMAIL_MESSAGE"
          autoComplete="off"
          spellCheck={false}
          className="bg-input text-foreground-strong placeholder:text-foreground-weak hover:bg-input-hover focus:bg-input-active focus-visible:shadow-focus-ring disabled:bg-input-disabled rounded-lg shadow-[0_0_0_1px_var(--color-border)] py-2 px-3 font-mono text-sm focus:outline-none transition-[background-color,box-shadow,color] duration-150"
        />
        <span className="text-foreground-weak text-sm">
          SCREAMING_SNAKE_CASE. Find slugs in{" "}
          <a
            href="https://docs.composio.dev/triggers"
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground underline underline-offset-2"
          >
            Composio&apos;s trigger catalog
          </a>
          .
        </span>
        {state.fieldErrors?.triggerType && (
          <span className="text-sentiment-negative text-sm">
            {state.fieldErrors.triggerType}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-foreground text-sm font-medium">
          Config (JSON object)
        </span>
        <textarea
          name="trigger_config"
          rows={4}
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          disabled={pending}
          spellCheck={false}
          className="bg-input text-foreground-strong placeholder:text-foreground-weak hover:bg-input-hover focus:bg-input-active focus-visible:shadow-focus-ring disabled:bg-input-disabled rounded-lg shadow-[0_0_0_1px_var(--color-border)] py-2 px-3 font-mono text-sm leading-5 focus:outline-none transition-[background-color,box-shadow,color] duration-150 resize-y"
        />
        <span className="text-foreground-weak text-sm">
          Per-trigger config. Use{" "}
          <code className="bg-surface rounded px-1 py-0.5 text-sm">
            {"{}"}
          </code>{" "}
          when the trigger has no required fields.
        </span>
        {state.fieldErrors?.config && (
          <span className="text-sentiment-negative text-sm">
            {state.fieldErrors.config}
          </span>
        )}
      </label>

      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={pending || disabled || connections.length === 0}
        >
          {pending ? "Creating…" : "Create trigger"}
        </Button>
      </div>
    </form>
  );
}
