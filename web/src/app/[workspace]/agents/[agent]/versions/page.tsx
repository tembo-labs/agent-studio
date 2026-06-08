import { getStableVersion, listAgentVersions } from "@/lib/agent-versions";
import { listWorkspaceMembers } from "@/lib/workspace";

import { loadAgentContext } from "../agent-page-context";
import { VersionsSection } from "../versions-section";

export const dynamic = "force-dynamic";

// Versions tab — released stable snapshots, with the current one marked.

export default async function AgentVersionsPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string }>;
}) {
  const { workspace: slug, agent: agentName } = await params;
  const { workspace, canonicalName } = await loadAgentContext(slug, agentName);

  const [versions, stable, allMembers] = await Promise.all([
    listAgentVersions(workspace.id, canonicalName),
    getStableVersion(workspace.id, canonicalName),
    listWorkspaceMembers(workspace.id),
  ]);

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

  return (
    <VersionsSection
      versions={versions}
      stableVersionId={stable?.id ?? null}
      workspaceSlug={workspace.slug}
      agentName={canonicalName}
      nameFor={nameFor}
    />
  );
}
