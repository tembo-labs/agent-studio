"use client";

import { useActionState, useState } from "react";
import { useActionToast } from "@/lib/use-action-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_DESCRIPTIONS, type WorkspaceRole } from "@/lib/rbac";

import { inviteMemberAction, type MemberFormState } from "./actions";

const INITIAL: MemberFormState = {};

export function AddMemberForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, formAction, pending] = useActionState(
    inviteMemberAction,
    INITIAL,
  );
  useActionToast(state);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("operator");
  const [copied, setCopied] = useState(false);

  async function copyTemplate() {
    if (!state.template) return;
    await navigator.clipboard.writeText(state.template);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <div className="grid gap-1.5">
        <Label htmlFor="add-member-email" className="text-sm">
          Email
        </Label>
        <Input
          id="add-member-email"
          name="email"
          type="email"
          required
          disabled={pending}
          placeholder="alice@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="text-foreground-muted text-sm">
          We don&apos;t send email yet — after inviting, copy the message and
          send it. They join automatically when they sign in with this email.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="add-member-role" className="text-sm">
          Role
        </Label>
        <select
          id="add-member-role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as WorkspaceRole)}
          disabled={pending}
          className="bg-input text-foreground-strong hover:bg-input-hover focus:bg-input-active focus-visible:shadow-focus-ring disabled:bg-input-disabled rounded-lg shadow-[0_0_0_1px_var(--color-border)] py-2 px-3 text-sm focus:outline-none transition-[background-color,box-shadow,color] duration-150"
        >
          {ROLE_DESCRIPTIONS.map((r) => (
            <option key={r.role} value={r.role}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Inviting…" : "Send invite"}
        </Button>
      </div>

      {state.template && (
        <div className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm font-medium">
              Copy this to {state.invitedEmail}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={copyTemplate}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <textarea
            readOnly
            value={state.template}
            rows={6}
            className="bg-input text-foreground-strong w-full resize-none rounded-lg p-2 font-mono text-xs shadow-[0_0_0_1px_var(--color-border)]"
          />
        </div>
      )}
    </form>
  );
}
