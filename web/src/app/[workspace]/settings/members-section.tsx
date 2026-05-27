import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { ROLE_DESCRIPTIONS, type WorkspaceRole } from "@/lib/rbac";
import { type WorkspaceMember } from "@/lib/workspace";

import { AddMemberForm } from "./add-member-form";
import { MemberRow } from "./member-row";

// Settings → Members (US-0.4-02). Lists every workspace member with
// their role. workspace_admin sees an inline role picker per row
// and an "Add member" form below. Operator and viewer see the list
// without the controls — the page renders for everyone so members
// can see "who's in this workspace" even if they can't change it.

type Props = {
  workspaceSlug: string;
  members: WorkspaceMember[];
  /** Current viewer's role; gates the admin-only controls. */
  currentUserRole: WorkspaceRole;
  /** Current viewer's user id; used to mark the "(you)" row. */
  currentUserId: string;
};

export function MembersSection({
  workspaceSlug,
  members,
  currentUserRole,
  currentUserId,
}: Props) {
  const canManage = currentUserRole === "workspace_admin";
  return (
    <Section
      title="Members"
      description={
        canManage
          ? "Add a member by email or change their role. Roles enforce at the API layer, not just the UI."
          : "Workspace members and their roles. Ask a workspace admin to change yours."
      }
    >
      <div className="flex flex-col gap-4">
        <ul className="border-border bg-surface divide-border-weak divide-y overflow-hidden rounded-lg border">
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              workspaceSlug={workspaceSlug}
              member={m}
              canManage={canManage}
              isSelf={m.userId === currentUserId}
            />
          ))}
        </ul>

        {canManage && (
          <details className="bg-surface border-border rounded-lg border p-3">
            <summary className="text-foreground cursor-pointer text-sm font-medium">
              Add a member
            </summary>
            <div className="mt-3">
              <AddMemberForm workspaceSlug={workspaceSlug} />
            </div>
          </details>
        )}

        <details>
          <summary className="text-foreground-weak hover:text-foreground cursor-pointer text-xs">
            Role reference
          </summary>
          <dl className="mt-2 flex flex-col gap-1.5 text-xs">
            {ROLE_DESCRIPTIONS.map((r) => (
              <div key={r.role} className="flex items-baseline gap-2">
                <Badge variant={roleVariant(r.role)} size="small">
                  {r.label}
                </Badge>
                <span className="text-foreground-weak">{r.description}</span>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </Section>
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
