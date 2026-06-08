"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/lib/use-action-toast";

import {
  removeNativeOAuthAppAction,
  saveNativeOAuthAppAction,
  type NativeOAuthAppState,
} from "./native-oauth-app-actions";

// Admin form to configure a manual Native MCP provider's OAuth app (HubSpot).
// The provider doesn't support auto-registration (DCR), so an admin creates an
// OAuth app at the provider, registers the redirect URI shown here, and stores
// the client_id/secret. Until configured, Connect is gated.

const INITIAL: NativeOAuthAppState = {};

type Props = {
  workspaceSlug: string;
  providerSlug: string;
  providerDisplayName: string;
  redirectUri: string;
  /** Present when already configured. */
  clientId?: string;
  secretLast4?: string;
  /** Docs link for creating the app at the provider. */
  setupUrl?: string;
};

export function ConfigureNativeOAuthApp({
  workspaceSlug,
  providerSlug,
  providerDisplayName,
  redirectUri,
  clientId,
  secretLast4,
  setupUrl,
}: Props) {
  const configured = Boolean(clientId);
  const [editing, setEditing] = useState(!configured);
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
    <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-foreground text-sm font-medium">
          {providerDisplayName} OAuth app
        </span>
        {configured && (
          <span className="text-foreground-muted text-xs">
            Configured · {clientId} · secret ••••{secretLast4}
          </span>
        )}
      </div>

      <p className="text-foreground-weak text-sm leading-5">
        {providerDisplayName} doesn&apos;t support auto-registration, so connect
        a {providerDisplayName} OAuth app once for the workspace.
        {setupUrl ? (
          <>
            {" "}
            <a
              href={setupUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground hover:underline"
            >
              Create an {providerDisplayName} MCP auth app →
            </a>
          </>
        ) : null}{" "}
        Register this redirect URI on it:
      </p>

      <Field label="Redirect URI" value={redirectUri} />

      {editing ? (
        <form action={saveAction} className="flex flex-col gap-3">
          <input type="hidden" name="workspace" value={workspaceSlug} />
          <input type="hidden" name="provider" value={providerSlug} />
          <div className="grid gap-1.5">
            <Label htmlFor={`${providerSlug}-client-id`} className="text-sm">
              Client ID
            </Label>
            <Input
              id={`${providerSlug}-client-id`}
              name="client_id"
              autoComplete="off"
              spellCheck={false}
              required
              disabled={savePending}
              defaultValue={clientId ?? ""}
              placeholder="The app's client ID"
              className="max-w-md font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${providerSlug}-client-secret`} className="text-sm">
              Client secret
            </Label>
            <Input
              id={`${providerSlug}-client-secret`}
              name="client_secret"
              type="password"
              autoComplete="off"
              spellCheck={false}
              required
              disabled={savePending}
              placeholder={
                configured ? "Re-enter to replace" : "Paste the client secret"
              }
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
              {savePending ? "Saving…" : "Save OAuth app"}
            </Button>
            {configured && (
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={() => setEditing(false)}
                disabled={savePending}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : (
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
  );
}

function Field({ label, value }: { label: string; value: string }) {
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
