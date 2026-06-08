import Link from "next/link";

import { Section } from "@/components/section";
import {
  getAgentDailyRunBands30d,
  getAgentStats30d,
  listAgentFailureGroups30d,
  listAgentToolUsage30d,
  listRecentRunsForAgent,
} from "@/lib/runs-db";

import { AgentDashboard } from "./agent-dashboard";
import { loadAgentContext } from "./agent-page-context";
import { RecentRuns } from "./recent-runs";

export const dynamic = "force-dynamic";

// Overview tab — the agent's at-a-glance landing: 30-day dashboard plus a peek
// at the most recent runs. The header + nav come from the layout.

const RECENT_PEEK = 5;

export default async function AgentOverviewPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string }>;
}) {
  const { workspace: slug, agent: agentName } = await params;
  const { workspace, canonicalName } = await loadAgentContext(slug, agentName);

  const [stats, daily, failures, toolUsage, recentRuns] = await Promise.all([
    getAgentStats30d(workspace.id, canonicalName),
    getAgentDailyRunBands30d(workspace.id, canonicalName),
    listAgentFailureGroups30d(workspace.id, canonicalName, 5),
    listAgentToolUsage30d(workspace.id, canonicalName),
    listRecentRunsForAgent(workspace.id, canonicalName, RECENT_PEEK),
  ]);

  const runsHref = `/${workspace.slug}/agents/${encodeURIComponent(canonicalName)}/runs`;

  return (
    <>
      <AgentDashboard
        stats={stats}
        daily={daily}
        failures={failures}
        toolUsage={toolUsage}
        workspaceSlug={workspace.slug}
        agentName={canonicalName}
      />

      <Section
        title="Recent runs"
        actions={
          recentRuns.length > 0 ? (
            <Link
              href={runsHref}
              className="text-foreground-weak hover:text-foreground text-sm"
            >
              View all →
            </Link>
          ) : undefined
        }
      >
        <RecentRuns
          runs={recentRuns}
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
        />
      </Section>
    </>
  );
}
