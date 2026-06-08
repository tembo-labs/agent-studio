import { Section } from "@/components/section";
import { listRecentRunsForAgent } from "@/lib/runs-db";

import { loadAgentContext } from "../agent-page-context";
import { RecentRuns } from "../recent-runs";

export const dynamic = "force-dynamic";

// Runs tab — the agent's recent run history. Each row links to the run detail.

const RUNS_LIMIT = 25;

export default async function AgentRunsPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string }>;
}) {
  const { workspace: slug, agent: agentName } = await params;
  const { workspace, canonicalName } = await loadAgentContext(slug, agentName);

  const runs = await listRecentRunsForAgent(
    workspace.id,
    canonicalName,
    RUNS_LIMIT,
  );

  return (
    <Section
      title="Runs"
      description={
        runs.length === 0
          ? undefined
          : `The ${runs.length} most recent run${runs.length === 1 ? "" : "s"}.`
      }
    >
      <RecentRuns
        runs={runs}
        workspaceSlug={workspace.slug}
        agentName={canonicalName}
      />
    </Section>
  );
}
