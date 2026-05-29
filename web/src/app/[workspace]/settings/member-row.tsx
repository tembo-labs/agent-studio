"use client";

import { useActionState, useState } from "react";
import { useActionToast } from "@/lib/use-action-toast";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { ROLE_DESCRIPTIONS, type WorkspaceRole } from "@/lib/rbac";
import { type WorkspaceMember } from "@/lib/workspace";

import {
  changeMemberRoleAction,
  removeMemberAction,
  type MemberFormState,
} from "./actions";

const INITIAL: MemberFormState = {};

type Props = {
  workspaceSlug: string;
  member: WorkspaceMember;
  canManage: boolean;
  isSelf: boolean;
};

export function MemberRow({ workspaceSlug, member, canManage, isSelf }: Props) {
  const [changeState, changeAction, changePending] = useActionState(
    changeMemberRoleAction,
    INITIAL,
  );
  useActionToast(changeState);
  const [removeState, removeAction, removePending] = useActionState(
    removeMemberAction,
    INITIAL,
  );
  useActionToast(removeState);
  // Track the local select value so the user gets immediate feedback;
  // the role committed at the server might lag if there's an error.
  const [roleDraft, setRoleDraft] = useState<WorkspaceRole>(member.role);

  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-foreground truncate font-medium">
            {member.name ?? member.email}
          </span>
          {isSelf && (
            <span className="text-foreground-muted text-sm">(you)</span>
          )}
        </div>
        <div className="text-foreground-weak flex items-center gap-2 text-xs">
          {member.name && <span className="truncate">{member.email}</span>}
          <span className="text-foreground-muted">
            joined <LocalTime iso={member.joinedAt.toISOString()} />
          </span>
        </div>
        {(changeState.error || removeState.error) && (
          <p className="text-sentiment-negative text-xs" role="alert">
            {changeState.error ?? removeState.error}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {canManage ? (
          <form action={changeAction}>
            <input type="hidden" name="workspace" value={workspaceSlug} />
            <input type="hidden" name="user_id" value={member.userId} />
            <select
              name="role"
              value={roleDraft}
              onChange={(e) => {
                const next = e.target.value as WorkspaceRole;
                setRoleDraft(next);
                // Submit immediately on change — same UX as the
                // automation toggle.
                e.currentTarget.form?.requestSubmit();
              }}
              disabled={changePending}
              className="bg-input text-foreground hover:bg-input-hover focus:bg-input-active focus-visible:shadow-focus-ring disabled:bg-input-disabled rounded-lg shadow-[0_0_0_1px_var(--color-border)] py-1 px-2 text-xs focus:outline-none transition-[background-color,box-shadow,color] duration-150"
            >
              {ROLE_DESCRIPTIONS.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <Badge variant={roleVariant(member.role)} size="small">
            {roleLabel(member.role)}
          </Badge>
        )}

        {canManage && (
          <form action={removeAction}>
            <input type="hidden" name="workspace" value={workspaceSlug} />
            <input type="hidden" name="user_id" value={member.userId} />
            <button
              type="submit"
              disabled={removePending}
              className="text-foreground-weak hover:text-sentiment-negative text-xs disabled:opacity-60"
            >
              {removePending ? "Removing…" : "Remove"}
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

function roleVariant(role: WorkspaceRole): "blue" | "green" | "gray" {
  switch (role) {
    case "workspace_admin":
      return "blue";
    case "operator":
      return "green";
    case "viewer":
      return "gray";
  }
}

function roleLabel(role: WorkspaceRole): string {
  return ROLE_DESCRIPTIONS.find((r) => r.role === role)?.label ?? role;
}
