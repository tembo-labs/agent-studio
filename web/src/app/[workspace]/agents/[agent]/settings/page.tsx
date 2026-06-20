import { Section } from "@/components/section";
import { getAgentOwner } from "@/lib/agent-versions";
import { meetsMinRole } from "@/lib/rbac";
import { getWorkspaceRole, listWorkspaceMembers } from "@/lib/workspace";

import { AgentLockControl } from "../agent-lock-control";
import { AgentOwnerControl } from "../agent-owner-control";
import { loadAgentContext } from "../agent-page-context";
import { DeleteAgentButton } from "../delete-agent-button";

export const dynamic = "force-dynamic";

// Settings tab — agent ownership and the danger zone (delete), moved off the
// header. Ownership decides who scheduled runs act as and who may promote.

export default async function AgentSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string }>;
}) {
  const { workspace: slug, agent: agentName } = await params;
  const { session, workspace, canonicalName, locked } = await loadAgentContext(
    slug,
    agentName,
  );

  const [owner, allMembers, currentUserRole] = await Promise.all([
    getAgentOwner(workspace.id, canonicalName),
    listWorkspaceMembers(workspace.id),
    getWorkspaceRole(workspace.id, session.user.id),
  ]);

  const canEdit = meetsMinRole(currentUserRole, "operator");
  const isAdmin = currentUserRole === "workspace_admin";
  const isOwner = owner?.ownerUserId === session.user.id;
  const canAssignOwner = canEdit && (isAdmin || !owner || isOwner);

  const nameCounts = new Map<string, number>();
  for (const m of allMembers) {
    if (m.name) nameCounts.set(m.name, (nameCounts.get(m.name) ?? 0) + 1);
  }
  const nameFor = (userId: string): string => {
    const m = allMembers.find((x) => x.userId === userId);
    if (!m) return "unknown";
    if (!m.name) return m.email;
    return (nameCounts.get(m.name) ?? 0) > 1 ? `${m.name} (${m.email})` : m.name;
  };
  const ownerLabel = owner ? nameFor(owner.ownerUserId) : null;

  return (
    <>
      <Section
        title="Ownership"
        description="The owner is who scheduled runs act as (their connections), and who — with admins — can promote the draft to stable."
      >
        <AgentOwnerControl
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
          ownerUserId={owner?.ownerUserId ?? null}
          ownerLabel={ownerLabel}
          canAssign={canAssignOwner}
          members={allMembers.map((m) => ({
            userId: m.userId,
            name: m.name,
            email: m.email,
          }))}
        />
      </Section>

      <Section
        title="Locked"
        description="Lock a governed agent (e.g. regulated drafting) so users can't change it in-app and its history is hidden — it then changes only via repo PRs."
      >
        <AgentLockControl
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
          locked={locked}
          canManage={isAdmin}
        />
      </Section>

      {canEdit && (
        <Section
          title="Danger"
          description="Deleting removes the agent file from the connected repo. It can be restored from Settings → Deleted agents."
        >
          <DeleteAgentButton
            workspaceSlug={workspace.slug}
            agentName={canonicalName}
          />
        </Section>
      )}
    </>
  );
}
