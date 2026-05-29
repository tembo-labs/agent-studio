"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_DESCRIPTIONS, type WorkspaceRole } from "@/lib/rbac";

import { addMemberAction, type MemberFormState } from "./actions";

const INITIAL: MemberFormState = {};

export function AddMemberForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, formAction, pending] = useActionState(
    addMemberAction,
    INITIAL,
  );
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("operator");

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
          The user must have signed in to TAS at least once. We don&apos;t
          email invitations.
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
          {pending ? "Adding…" : "Add member"}
        </Button>
      </div>
    </form>
  );
}
