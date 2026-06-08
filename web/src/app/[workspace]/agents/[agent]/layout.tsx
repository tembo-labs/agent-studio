import Link from "next/link";
import type { ReactNode } from "react";

import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FRAMEWORK_LABELS } from "@/lib/agent-framework";
import { getAgentOwner, getStableVersion } from "@/lib/agent-versions";
import { toolkitLabel } from "@/lib/composio-label";
import { getMcpProvider } from "@/lib/mcp-providers";
import { meetsMinRole } from "@/lib/rbac";
import {
  getWorkspaceRole,
  isTemboConfigured,
  listWorkspaceMembers,
} from "@/lib/workspace";

import {
  AgentConnectionIcons,
  type ConnectionIconItem,
} from "./agent-connection-icons";
import { AgentNav } from "./agent-nav";
import { AgentOwnerControl } from "./agent-owner-control";
import { loadAgentContext } from "./agent-page-context";
import { DeleteAgentButton } from "./delete-agent-button";
import { DraftChangesBanner } from "./draft-changes-banner";
import { PromoteButton } from "./promote-button";
import { RunNowButton } from "./run-now-button";

export const dynamic = "force-dynamic";

// Shared shell for the agent view. Renders the constant header (name, badges,
// connection icons, owner, action buttons, draft-changes banner) and the left
// tab rail; each tab's content renders into {children}. Mirrors the Settings /
// Connections two-column layout.

export default async function AgentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string; agent: string }>;
}) {
  const { workspace: slug, agent: agentName } = await params;
  const { session, workspace, repo, agent, raw, canonicalName } =
    await loadAgentContext(slug, agentName);

  const [currentUserRole, temboConfigured, stable, owner, allMembers] =
    await Promise.all([
      getWorkspaceRole(workspace.id, session.user.id),
      isTemboConfigured(workspace.id),
      getStableVersion(workspace.id, canonicalName),
      getAgentOwner(workspace.id, canonicalName),
      listWorkspaceMembers(workspace.id),
    ]);

  const canEdit = meetsMinRole(currentUserRole, "operator");
  const isAdmin = currentUserRole === "workspace_admin";
  const runAsMembers = isAdmin
    ? allMembers.map((m) => ({ userId: m.userId, name: m.name, email: m.email }))
    : undefined;

  // Disambiguate display names by email when two members share a name.
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
  const isOwner = owner?.ownerUserId === session.user.id;
  const canPromote = canEdit && (!owner || isOwner || isAdmin);
  const canAssignOwner = canEdit && (isAdmin || !owner || isOwner);
  const draftChanged = agent.ok && (!stable || stable.specContent !== raw);
  const nextVersion = (stable?.versionNumber ?? 0) + 1;
  const sourceHref = `https://github.com/${repo.owner}/${repo.name}/blob/${repo.defaultBranch}/${agent.path}`;

  // External services the agent declares, deduped by slug, for the icon row.
  const connectionIcons: ConnectionIconItem[] = [];
  if (agent.ok && agent.spec.framework === "pydantic-agentspec") {
    const seen = new Set<string>();
    for (const c of agent.spec.connections) {
      const cslug = c.toolkit.trim().toLowerCase();
      if (!cslug || seen.has(cslug)) continue;
      seen.add(cslug);
      connectionIcons.push({
        slug: cslug,
        name: c.name,
        label:
          c.source === "native-mcp"
            ? (getMcpProvider(cslug)?.displayName ?? toolkitLabel(cslug))
            : toolkitLabel(cslug),
        source: c.source,
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <BackLink href={`/${workspace.slug}`} label="Agents" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
              {canonicalName}
            </h1>
            {agent.ok ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {stable ? (
                  <Badge variant="green" size="small">
                    Stable v{stable.versionNumber}
                  </Badge>
                ) : (
                  <Badge variant="gray" size="small">
                    Draft only
                  </Badge>
                )}
                <Badge variant="blue" size="small">
                  {FRAMEWORK_LABELS[agent.spec.framework]}
                </Badge>
                <Badge variant="purple" size="small">
                  {agent.spec.model ?? "—"}
                </Badge>
                <code className="text-foreground-muted text-sm">
                  {agent.filename}
                </code>
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
              </div>
            ) : (
              <p className="text-sentiment-negative text-sm">
                Invalid agent: {agent.error}
                {agent.detail ? ` — ${agent.detail}` : ""}
              </p>
            )}
            {connectionIcons.length > 0 && (
              <AgentConnectionIcons connections={connectionIcons} />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost">
              <a href={sourceHref} target="_blank" rel="noreferrer noopener">
                View source
              </a>
            </Button>
            {agent.ok && canEdit && temboConfigured && (
              <Button asChild variant="secondary">
                <Link
                  href={`/${workspace.slug}/agents/${encodeURIComponent(canonicalName)}/chat`}
                >
                  Chat to edit
                </Link>
              </Button>
            )}
            {canEdit && (
              <DeleteAgentButton
                workspaceSlug={workspace.slug}
                agentName={canonicalName}
              />
            )}
            {agent.ok && canPromote && (
              <PromoteButton
                workspaceSlug={workspace.slug}
                agentName={canonicalName}
                nextVersion={nextVersion}
                hasChanges={draftChanged}
                isOwner={isOwner}
                ownerLabel={ownerLabel}
              />
            )}
            {agent.ok && canEdit && (
              <RunNowButton
                workspaceSlug={workspace.slug}
                agentName={canonicalName}
                members={runAsMembers}
                currentUserId={session.user.id}
                hasStable={stable !== null}
              />
            )}
          </div>
        </div>
        {agent.ok && agent.spec.description && (
          <p className="text-foreground-weak max-w-prose text-sm leading-6">
            {agent.spec.description}
          </p>
        )}
      </div>

      {stable && draftChanged && canEdit && (
        <DraftChangesBanner
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
        />
      )}

      <hr className="border-[var(--color-border-weak)]" />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
        <AgentNav workspaceSlug={workspace.slug} agentName={canonicalName} />
        <div className="flex min-w-0 flex-1 flex-col gap-8">{children}</div>
      </div>
    </div>
  );
}
