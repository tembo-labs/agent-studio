"use client";

import { useActionState } from "react";

import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/lib/use-action-toast";

import { createResetLinkAction, type ResetLinkState } from "./members-actions";

const INITIAL: ResetLinkState = {};

// Admin control on the member detail page (email/password instances
// only — the server action re-checks). Mints a one-time reset link and
// presents it for copy; TAS sends no email, the admin delivers it.
export function ResetPasswordLink({
  workspaceSlug,
  userId,
  email,
}: {
  workspaceSlug: string;
  userId: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(createResetLinkAction, INITIAL);
  useActionToast(state);

  return (
    <div className="flex flex-col gap-3">
      <form action={action}>
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <input type="hidden" name="user_id" value={userId} />
        <Button type="submit" size="small" variant="secondary" disabled={pending}>
          {pending ? "Generating…" : "Generate reset link"}
        </Button>
      </form>

      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}

      {state.url && (
        <div className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-foreground-weak text-sm">
            Send this link to <span className="text-foreground">{email}</span>.
            It works once and expires in an hour.
          </p>
          <div className="flex items-center gap-2">
            <code className="text-foreground bg-surface-secondary min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm">
              {state.url}
            </code>
            <CopyButton text={state.url} ariaLabel="Copy reset link" />
          </div>
        </div>
      )}
    </div>
  );
}
