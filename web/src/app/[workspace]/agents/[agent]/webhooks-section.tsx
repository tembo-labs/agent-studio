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
  createWebhookAction,
  deleteWebhookAction,
  rotateWebhookAction,
  toggleWebhookAction,
  type WebhookActionState,
} from "./webhooks-actions";

// Per-agent External webhooks section on the agent detail page (next to
// Triggers). Each webhook is an inbound HTTP endpoint that fires this agent —
// an outside system (Clay) POSTs JSON with an `Authorization: Bearer <token>`
// header. The token is shown ONCE on create/rotate.

export type WebhookView = {
  id: string;
  name: string;
  tokenLast4: string;
  enabled: boolean;
  lastFiredAtIso: string | null;
  lastFireError: string | null;
};

const INITIAL: WebhookActionState = {};

type Props = {
  workspaceSlug: string;
  agentName: string;
  baseUrl: string;
  webhooks: WebhookView[];
  canManage: boolean;
  /** Admin-only owner picker; undefined for non-admins (owner = self). */
  owners?: { userId: string; label: string }[];
};

export function WebhooksSection({
  workspaceSlug,
  agentName,
  baseUrl,
  webhooks,
  canManage,
  owners,
}: Props) {
  return (
    <Section
      collapsible
      title={
        webhooks.length > 0
          ? `External webhooks (${webhooks.length})`
          : "External webhooks"
      }
      description="Inbound HTTP endpoints that fire this agent from an outside system (e.g. Clay). The caller POSTs JSON with an Authorization: Bearer token; TAS queues a run and passes the body to the agent."
    >
      <div className="flex flex-col gap-4">
        {webhooks.length === 0 ? (
          <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
            No webhooks yet.
            {canManage ? " Add one below." : ""}
          </p>
        ) : (
          <ul className="divide-border flex flex-col divide-y border-y border-[var(--color-border)]">
            {webhooks.map((w) => (
              <WebhookRow
                key={w.id}
                workspaceSlug={workspaceSlug}
                baseUrl={baseUrl}
                webhook={w}
                canManage={canManage}
              />
            ))}
          </ul>
        )}

        {canManage && (
          <AddWebhookForm
            workspaceSlug={workspaceSlug}
            agentName={agentName}
            owners={owners}
          />
        )}
      </div>
    </Section>
  );
}

function WebhookRow({
  workspaceSlug,
  baseUrl,
  webhook,
  canManage,
}: {
  workspaceSlug: string;
  baseUrl: string;
  webhook: WebhookView;
  canManage: boolean;
}) {
  const url = `${baseUrl}/api/hooks/webhook/${webhook.id}`;
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleWebhookAction,
    INITIAL,
  );
  const [rotateState, rotateAction, rotatePending] = useActionState(
    rotateWebhookAction,
    INITIAL,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteWebhookAction,
    INITIAL,
  );
  useActionToast(toggleState);
  useActionToast(rotateState);
  useActionToast(deleteState);

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {webhook.enabled ? (
              webhook.lastFireError ? (
                <Badge variant="red" size="small">
                  Error
                </Badge>
              ) : (
                <Badge variant="green" size="small">
                  On
                </Badge>
              )
            ) : (
              <Badge variant="gray" size="small">
                Off
              </Badge>
            )}
            <span className="text-foreground text-sm font-medium">
              {webhook.name}
            </span>
            <code className="text-foreground-muted text-sm">
              ••••{webhook.tokenLast4}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-foreground-weak truncate font-mono text-xs">
              {url}
            </code>
            <CopyButton value={url} label="Copy URL" />
          </div>
          <p className="text-foreground-weak text-sm">
            {webhook.lastFiredAtIso ? (
              <>
                Last fired{" "}
                <LocalTime iso={webhook.lastFiredAtIso} style="relative" />
              </>
            ) : (
              "Never fired"
            )}
            {webhook.lastFireError ? (
              <span className="text-sentiment-negative">
                {" · "}
                {webhook.lastFireError}
              </span>
            ) : null}
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            <form action={toggleAction}>
              <input type="hidden" name="workspace" value={workspaceSlug} />
              <input type="hidden" name="id" value={webhook.id} />
              <input
                type="hidden"
                name="enabled"
                value={webhook.enabled ? "false" : "true"}
              />
              <Button
                type="submit"
                variant="ghost"
                size="small"
                disabled={togglePending}
              >
                {webhook.enabled ? "Disable" : "Enable"}
              </Button>
            </form>
            <form action={rotateAction}>
              <input type="hidden" name="workspace" value={workspaceSlug} />
              <input type="hidden" name="id" value={webhook.id} />
              <Button
                type="submit"
                variant="ghost"
                size="small"
                disabled={rotatePending}
              >
                Rotate
              </Button>
            </form>
            <form action={deleteAction}>
              <input type="hidden" name="workspace" value={workspaceSlug} />
              <input type="hidden" name="id" value={webhook.id} />
              <Button
                type="submit"
                variant="ghost"
                size="small"
                disabled={deletePending}
              >
                Remove
              </Button>
            </form>
          </div>
        )}
      </div>
      {rotateState.secret && (
        <SecretReveal
          url={rotateState.secret.url}
          token={rotateState.secret.token}
        />
      )}
    </li>
  );
}

export function AddWebhookForm({
  workspaceSlug,
  agentName,
  owners,
}: {
  workspaceSlug: string;
  agentName: string;
  owners?: { userId: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(
    createWebhookAction,
    INITIAL,
  );
  useActionToast(state);

  return (
    <form
      action={action}
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <span className="text-foreground text-sm font-medium">Add a webhook</span>
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="agent" value={agentName} />
      <div className="grid gap-1.5">
        <Label htmlFor="webhook-name" className="text-sm">
          Name
        </Label>
        <Input
          id="webhook-name"
          name="name"
          autoComplete="off"
          required
          disabled={pending}
          placeholder="Clay signup enrichment"
          className="max-w-sm"
        />
      </div>
      {owners && owners.length > 0 && (
        <div className="grid gap-1.5">
          <Label htmlFor="webhook-owner" className="text-sm">
            Run as
          </Label>
          <select
            id="webhook-owner"
            name="owner"
            disabled={pending}
            className="bg-input text-foreground-strong focus-visible:shadow-focus-ring h-8 max-w-sm rounded-lg px-3 text-sm font-medium shadow-[0_0_0_1px_var(--color-border)]"
          >
            <option value="">Me</option>
            {owners.map((o) => (
              <option key={o.userId} value={o.userId}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-foreground-muted text-sm">
            Runs use this member&apos;s connections + the workspace&apos;s
            secrets.
          </p>
        </div>
      )}
      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" size="big" disabled={pending}>
          {pending ? "Creating…" : "Create webhook"}
        </Button>
      </div>
      {state.secret && (
        <SecretReveal url={state.secret.url} token={state.secret.token} />
      )}
    </form>
  );
}

function SecretReveal({ url, token }: { url: string; token: string }) {
  return (
    <div className="border-sentiment-caution bg-[var(--color-sentiment-caution-subtle)] flex flex-col gap-2 rounded-lg border p-3">
      <span className="text-foreground text-sm font-medium">
        Copy these now — the token is shown only once.
      </span>
      <Field label="Endpoint URL" value={url} />
      <Field label="Bearer token" value={token} mono />
      <p className="text-foreground-weak text-sm leading-5">
        In Clay, add an HTTP API column: method <code>POST</code>, URL above, and
        a header <code>Authorization: Bearer &lt;token&gt;</code>. The agent
        receives the request body as its input.
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
