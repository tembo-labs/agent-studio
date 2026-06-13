"use client";

import { useActionState, useState } from "react";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/lib/use-action-toast";

import {
  createApiKeyAction,
  deleteApiKeyAction,
  toggleApiKeyAction,
  type ApiKeyActionState,
} from "./actions";

// Settings → API keys. Personal-access-token UX: list the caller's own keys,
// mint a new one (token revealed once), disable/revoke. Modeled on the agent
// webhooks section.

export type ApiKeyView = {
  id: string;
  name: string;
  tokenLast4: string;
  enabled: boolean;
  lastUsedAtIso: string | null;
  createdAtIso: string;
};

const INITIAL: ApiKeyActionState = {};

export function ApiKeysSection({
  workspaceSlug,
  origin,
  keys,
}: {
  workspaceSlug: string;
  origin: string;
  keys: ApiKeyView[];
}) {
  return (
    <Section
      title={keys.length > 0 ? `Your API keys (${keys.length})` : "Your API keys"}
      description={
        <>
          Credentials for the public REST API and the MCP server. A key acts as
          you — it uses your connections and your workspace role. Point Claude
          Code at the MCP server:
          <br />
          <code className="text-foreground-weak mt-1 inline-block font-mono text-xs">
            claude mcp add --transport http tas {origin}/mcp --header
            &quot;Authorization: Bearer tas_…&quot;
          </code>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {keys.length === 0 ? (
          <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
            No API keys yet. Create one below.
          </p>
        ) : (
          <ul className="divide-border flex flex-col divide-y border-y border-[var(--color-border)]">
            {keys.map((k) => (
              <ApiKeyRow key={k.id} workspaceSlug={workspaceSlug} apiKey={k} />
            ))}
          </ul>
        )}

        <AddApiKeyForm workspaceSlug={workspaceSlug} origin={origin} />
      </div>
    </Section>
  );
}

function ApiKeyRow({
  workspaceSlug,
  apiKey,
}: {
  workspaceSlug: string;
  apiKey: ApiKeyView;
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleApiKeyAction,
    INITIAL,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteApiKeyAction,
    INITIAL,
  );
  useActionToast(toggleState);
  useActionToast(deleteState);

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {apiKey.enabled ? (
            <Badge variant="green" size="small">
              Active
            </Badge>
          ) : (
            <Badge variant="gray" size="small">
              Disabled
            </Badge>
          )}
          <span className="text-foreground text-sm font-medium">{apiKey.name}</span>
          <code className="text-foreground-muted text-sm">tas_…{apiKey.tokenLast4}</code>
        </div>
        <p className="text-foreground-weak text-sm">
          {apiKey.lastUsedAtIso ? (
            <>
              Last used <LocalTime iso={apiKey.lastUsedAtIso} style="relative" />
            </>
          ) : (
            "Never used"
          )}
          {" · created "}
          <LocalTime iso={apiKey.createdAtIso} style="relative" />
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <form action={toggleAction}>
          <input type="hidden" name="workspace" value={workspaceSlug} />
          <input type="hidden" name="id" value={apiKey.id} />
          <input
            type="hidden"
            name="enabled"
            value={apiKey.enabled ? "false" : "true"}
          />
          <Button type="submit" variant="ghost" size="small" disabled={togglePending}>
            {apiKey.enabled ? "Disable" : "Enable"}
          </Button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="workspace" value={workspaceSlug} />
          <input type="hidden" name="id" value={apiKey.id} />
          <Button type="submit" variant="ghost" size="small" disabled={deletePending}>
            Revoke
          </Button>
        </form>
      </div>
    </li>
  );
}

function AddApiKeyForm({
  workspaceSlug,
  origin,
}: {
  workspaceSlug: string;
  origin: string;
}) {
  const [state, action, pending] = useActionState(createApiKeyAction, INITIAL);
  useActionToast(state);

  return (
    <form
      action={action}
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <span className="text-foreground text-sm font-medium">Create an API key</span>
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <div className="grid gap-1.5">
        <Label htmlFor="api-key-name" className="text-sm">
          Name
        </Label>
        <Input
          id="api-key-name"
          name="name"
          autoComplete="off"
          required
          disabled={pending}
          placeholder="Claude Code on my laptop"
          className="max-w-sm"
        />
      </div>
      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" size="big" disabled={pending}>
          {pending ? "Creating…" : "Create API key"}
        </Button>
      </div>
      {state.secret && <SecretReveal token={state.secret.token} origin={origin} />}
    </form>
  );
}

function SecretReveal({ token, origin }: { token: string; origin: string }) {
  return (
    <div className="border-sentiment-caution bg-[var(--color-sentiment-caution-subtle)] flex flex-col gap-2 rounded-lg border p-3">
      <span className="text-foreground text-sm font-medium">
        Copy this now — the token is shown only once.
      </span>
      <Field label="API token" value={token} mono />
      <Field
        label="Add to Claude Code"
        value={`claude mcp add --transport http tas ${origin}/mcp --header "Authorization: Bearer ${token}"`}
        mono
      />
      <p className="text-foreground-weak text-sm leading-5">
        Use it as <code>Authorization: Bearer {"<token>"}</code> against{" "}
        <code>{origin}/api/v1/…</code> or the MCP server at{" "}
        <code>{origin}/mcp</code>.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-foreground-muted text-xs uppercase tracking-wide">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <code
          className={`bg-surface border-border min-w-0 flex-1 truncate rounded border px-2 py-1 text-xs ${mono ? "font-mono" : ""}`}
        >
          {value}
        </code>
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      </div>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="small"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
