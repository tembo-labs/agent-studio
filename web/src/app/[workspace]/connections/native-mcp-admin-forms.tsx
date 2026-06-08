"use client";

import { useActionState, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/lib/use-action-toast";

import {
  removeNativeOAuthAppAction,
  saveNativeOAuthAppAction,
  setProviderEnabledAction,
  type NativeOAuthAppState,
} from "./native-oauth-app-actions";

// Admin-only controls for the Native MCP "Manage providers" screen:
//  - ProviderEnableToggle: turn a provider on/off for regular members.
//  - NativeOAuthAppInstanceCard: one configured BYO OAuth app (replace / remove).
//  - AddNativeOAuthAppInstanceForm: register another OAuth app for a provider.

const INITIAL: NativeOAuthAppState = {};

export function ProviderEnableToggle({
  workspaceSlug,
  providerSlug,
  enabled,
  note,
}: {
  workspaceSlug: string;
  providerSlug: string;
  enabled: boolean;
  /** Optional caveat shown next to the toggle (e.g. "needs an app first"). */
  note?: string;
}) {
  const [state, action] = useActionState(setProviderEnabledAction, INITIAL);
  useActionToast(state);
  const [checked, setChecked] = useState(enabled);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="provider" value={providerSlug} />
      <input type="hidden" name="enabled" value={checked ? "true" : "false"} />
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            setChecked(e.target.checked);
            // Defer past React's commit so the hidden `enabled` input carries
            // the new value when the form submits.
            requestAnimationFrame(() => formRef.current?.requestSubmit());
          }}
          className="size-4 accent-[var(--focus-ring-color,#009eff)]"
        />
        <span className="text-foreground-weak">Available to members</span>
      </label>
      {note && <span className="text-foreground-muted text-xs">{note}</span>}
    </form>
  );
}

export function NativeOAuthAppInstanceCard({
  workspaceSlug,
  providerSlug,
  providerDisplayName,
  instance,
  label,
  clientId,
  secretLast4,
}: {
  workspaceSlug: string;
  providerSlug: string;
  providerDisplayName: string;
  instance: string;
  label: string | null;
  clientId: string;
  secretLast4: string;
}) {
  const [editing, setEditing] = useState(false);
  const [saveState, saveAction, savePending] = useActionState(
    saveNativeOAuthAppAction,
    INITIAL,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeNativeOAuthAppAction,
    INITIAL,
  );
  useActionToast(saveState);
  useActionToast(removeState);

  return (
    <div className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <code className="text-foreground text-sm font-medium">{instance}</code>
          {label && (
            <span className="text-foreground-weak text-sm">{label}</span>
          )}
          <span className="text-foreground-muted text-xs">
            {clientId} · secret ••••{secretLast4}
          </span>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => setEditing(true)}
            >
              Replace
            </Button>
            <form action={removeAction}>
              <input type="hidden" name="workspace" value={workspaceSlug} />
              <input type="hidden" name="provider" value={providerSlug} />
              <input type="hidden" name="instance" value={instance} />
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

      {editing && (
        <form action={saveAction} className="flex flex-col gap-3 pt-1">
          <input type="hidden" name="workspace" value={workspaceSlug} />
          <input type="hidden" name="provider" value={providerSlug} />
          <input type="hidden" name="instance" value={instance} />
          <div className="grid gap-1.5">
            <Label htmlFor={`${providerSlug}-${instance}-label`} className="text-sm">
              Label (optional)
            </Label>
            <Input
              id={`${providerSlug}-${instance}-label`}
              name="label"
              autoComplete="off"
              disabled={savePending}
              defaultValue={label ?? ""}
              placeholder={`e.g. ${providerDisplayName} marketing portal`}
              className="max-w-md"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${providerSlug}-${instance}-client-id`} className="text-sm">
              Client ID
            </Label>
            <Input
              id={`${providerSlug}-${instance}-client-id`}
              name="client_id"
              autoComplete="off"
              spellCheck={false}
              required
              disabled={savePending}
              defaultValue={clientId}
              className="max-w-md font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${providerSlug}-${instance}-client-secret`} className="text-sm">
              Client secret
            </Label>
            <Input
              id={`${providerSlug}-${instance}-client-secret`}
              name="client_secret"
              type="password"
              autoComplete="off"
              spellCheck={false}
              required
              disabled={savePending}
              placeholder="Re-enter to replace"
              className="max-w-md"
            />
            <p className="text-foreground-muted text-sm">
              Stored encrypted at rest (AES-256-GCM).
            </p>
          </div>
          {saveState.error && (
            <p className="text-sentiment-negative text-sm" role="alert">
              {saveState.error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="small" disabled={savePending}>
              {savePending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="small"
              onClick={() => setEditing(false)}
              disabled={savePending}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function AddNativeOAuthAppInstanceForm({
  workspaceSlug,
  providerSlug,
  providerDisplayName,
}: {
  workspaceSlug: string;
  providerSlug: string;
  providerDisplayName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    saveNativeOAuthAppAction,
    INITIAL,
  );
  useActionToast(state);

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="small"
        onClick={() => setOpen(true)}
      >
        + Add app instance
      </Button>
    );
  }

  return (
    <form
      action={action}
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border border-dashed p-3"
    >
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="provider" value={providerSlug} />
      <span className="text-foreground text-sm font-medium">
        New {providerDisplayName} OAuth app
      </span>
      <div className="grid gap-1.5">
        <Label htmlFor={`${providerSlug}-new-instance`} className="text-sm">
          App name
        </Label>
        <Input
          id={`${providerSlug}-new-instance`}
          name="instance"
          required
          pattern="[a-z0-9_-]+"
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
          placeholder="marketing"
          className="max-w-md font-mono"
        />
        <p className="text-foreground-muted text-sm">
          Lowercase letters, numbers, hyphens. Members pick this when connecting.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${providerSlug}-new-label`} className="text-sm">
          Label (optional)
        </Label>
        <Input
          id={`${providerSlug}-new-label`}
          name="label"
          autoComplete="off"
          disabled={pending}
          placeholder={`e.g. ${providerDisplayName} marketing portal`}
          className="max-w-md"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${providerSlug}-new-client-id`} className="text-sm">
          Client ID
        </Label>
        <Input
          id={`${providerSlug}-new-client-id`}
          name="client_id"
          required
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
          placeholder="The app's client ID"
          className="max-w-md font-mono"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${providerSlug}-new-client-secret`} className="text-sm">
          Client secret
        </Label>
        <Input
          id={`${providerSlug}-new-client-secret`}
          name="client_secret"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
          placeholder="Paste the client secret"
          className="max-w-md"
        />
        <p className="text-foreground-muted text-sm">
          Stored encrypted at rest (AES-256-GCM).
        </p>
      </div>
      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="small" disabled={pending}>
          {pending ? "Saving…" : "Add app"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="small"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function CopyableField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-foreground-muted text-xs uppercase tracking-wide">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <code className="bg-surface-secondary border-border min-w-0 flex-1 truncate rounded border px-2 py-1 font-mono text-xs">
          {value}
        </code>
        <Button
          type="button"
          variant="secondary"
          size="small"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
