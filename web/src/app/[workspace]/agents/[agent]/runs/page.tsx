import { Section } from "@/components/section";
import { listRunsForWorkspace } from "@/lib/runs-db";

import { RunsList } from "../../../runs/runs-list";
import { toLoaded } from "../../../runs/shape";
import { loadAgentContext } from "../agent-page-context";

export const dynamic = "force-dynamic";

// Runs tab — the agent's run history, using the same table as the workspace
// Runs page (minus the Agent + Input columns and the Agent filter), scoped to
// this agent. Keeps the status/trigger/search filters + pagination.

export default async function AgentRunsPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string }>;
}) {
  const { workspace: slug, agent: agentName } = await params;
  const { workspace, canonicalName } = await loadAgentContext(slug, agentName);

  const runs = await listRunsForWorkspace(workspace.id, {
    agentName: canonicalName,
  });

  return (
    <Section title="Runs" description="This agent's run history.">
      <RunsList
        workspaceSlug={workspace.slug}
        agentNames={[]}
        initial={runs.map(toLoaded)}
        initialFilters={{ agentName: canonicalName }}
        lockedAgent={canonicalName}
      />
    </Section>
  );
}
