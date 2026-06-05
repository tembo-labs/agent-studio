"use client";

import { useActionState, useEffect, useState } from "react";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/lib/use-action-toast";
import type { SecretConnectionPreview } from "@/lib/secret-connections";

import {
  removeSecretConnectionAction,
  setSecretConnectionAction,
  type SecretActionState,
} from "./secrets-actions";

// Secrets — the 3rd connection substrate. Free-form, workspace-level API keys
// (e.g. Clay) that sidecar Python tools read via tas_tools.secret("<slug>").
// Workspace-wide and admin-managed (unlike the per-user OAuth substrates).

const INITIAL: SecretActionState = {};

type Props = {
  workspaceSlug: string;
  secrets: SecretConnectionPreview[];
  canManage: boolean;
};

export function SecretsSection({ workspaceSlug, secrets, canManage }: Props) {
  return (
    <Section
      title="Secrets"
      description={
        "Workspace-level API keys for services that authenticate with a plain key (e.g. Clay). Set once by an admin and shared across the workspace; an agent's sidecar Python tools read a value with tas_tools.secret('name'). Stored encrypted at rest (AES-256-GCM)."
      }
    >
      <div className="flex flex-col gap-4">
        {secrets.length > 0 ? (
          <ul className="divide-border bg-surface border-border flex flex-col divide-y overflow-hidden rounded-lg border">
            {secrets.map((s) => (
              <SecretRow
                key={s.slug}
                workspaceSlug={workspaceSlug}
                secret={s}
                canManage={canManage}
              />
            ))}
          </ul>
        ) : (
          <p className="text-foreground-weak text-sm">
            No secrets yet.{" "}
            {canManage
              ? "Add one below to make it available to your agents' Python tools."
              : "An admin can add one under Connections → Secrets."}
          </p>
        )}

        {canManage ? (
          <AddSecretForm workspaceSlug={workspaceSlug} />
        ) : (
          <p className="text-foreground-muted text-sm">
            Only workspace admins can add or change secrets.
          </p>
        )}
      </div>
    </Section>
  );
}

function SecretRow({
  workspaceSlug,
  secret,
  canManage,
}: {
  workspaceSlug: string;
  secret: SecretConnectionPreview;
  canManage: boolean;
}) {
  const [rotating, setRotating] = useState(false);
  const [removeState, removeAction, removePending] = useActionState(
    removeSecretConnectionAction,
    INITIAL,
  );
  useActionToast(removeState);

  return (
    <li className="flex flex-col gap-3 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground font-mono text-sm font-medium">
            {secret.slug}
          </span>
          <span className="text-foreground-muted text-sm">
            ••••••••{secret.last4} · updated{" "}
            <LocalTime iso={secret.updatedAt} style="relative" />
            {secret.description ? ` · ${secret.description}` : ""}
          </span>
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              size="small"
              onClick={() => setRotating((v) => !v)}
            >
              {rotating ? "Cancel" : "Rotate"}
            </Button>
            <form action={removeAction}>
              <input type="hidden" name="workspace" value={workspaceSlug} />
              <input type="hidden" name="slug" value={secret.slug} />
              <Button
                type="submit"
                variant="ghost"
                size="small"
                disabled={removePending}
              >
                {removePending ? "Removing…" : "Remove"}
              </Button>
            </form>
          </div>
        )}
      </div>
      {rotating && canManage && (
        <RotateSecretForm
          workspaceSlug={workspaceSlug}
          slug={secret.slug}
          onDone={() => setRotating(false)}
        />
      )}
    </li>
  );
}

function RotateSecretForm({
  workspaceSlug,
  slug,
  onDone,
}: {
  workspaceSlug: string;
  slug: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(
    setSecretConnectionAction,
    INITIAL,
  );
  useActionToast(state);
  useEffect(() => {
    if (state.message) onDone();
    // Close the rotate form once the save succeeds; onDone is stable
    // enough that watching the message alone is the right trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.message]);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="slug" value={slug} />
      <Label htmlFor={`rotate-${slug}`} className="text-sm">
        New value for {slug}
      </Label>
      <Input
        id={`rotate-${slug}`}
        name="value"
        type="password"
        autoComplete="off"
        spellCheck={false}
        required
        disabled={pending}
        placeholder="Paste the new key"
      />
      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" size="small" disabled={pending}>
          {pending ? "Saving…" : "Save new value"}
        </Button>
      </div>
    </form>
  );
}

function AddSecretForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, action, pending] = useActionState(
    setSecretConnectionAction,
    INITIAL,
  );
  useActionToast(state);

  return (
    <form
      action={action}
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <span className="text-foreground text-sm font-medium">Add a secret</span>
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <div className="grid gap-1.5">
        <Label htmlFor="secret-slug" className="text-sm">
          Name
        </Label>
        <Input
          id="secret-slug"
          name="slug"
          autoComplete="off"
          spellCheck={false}
          required
          disabled={pending}
          placeholder="clay"
          className="max-w-xs font-mono"
        />
        <p className="text-foreground-muted text-sm">
          Lowercase letters, digits, hyphens, underscores. Agents read it by
          this exact name via{" "}
          <code className="font-mono">tas_tools.secret(&quot;name&quot;)</code>.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="secret-value" className="text-sm">
          Value
        </Label>
        <Input
          id="secret-value"
          name="value"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          disabled={pending}
          placeholder="Paste the API key"
          className="max-w-md"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="secret-description" className="text-sm">
          Description <span className="text-foreground-muted">(optional)</span>
        </Label>
        <Input
          id="secret-description"
          name="description"
          autoComplete="off"
          disabled={pending}
          placeholder="What this key is for"
          className="max-w-md"
        />
      </div>
      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" size="big" disabled={pending}>
          {pending ? "Saving…" : "Add secret"}
        </Button>
      </div>
    </form>
  );
}
