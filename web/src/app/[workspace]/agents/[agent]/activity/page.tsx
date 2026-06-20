import { redirect } from "next/navigation";

import { listAuditTimeline } from "@/lib/audit-db";

import { AgentTimeline } from "../agent-timeline";
import { loadAgentContext } from "../agent-page-context";

export const dynamic = "force-dynamic";

// Activity tab — this agent's slice of the audit timeline (runs, improvements,
// automations, triggers, member changes), with a link to the full Audit page.

const TIMELINE_LIMIT = 50;

export default async function AgentActivityPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string }>;
}) {
  const { workspace: slug, agent: agentName } = await params;
  const { workspace, canonicalName, locked } = await loadAgentContext(
    slug,
    agentName,
  );
  // Locked agents hide their history tabs (#12) — block the direct URL too.
  if (locked) {
    redirect(`/${slug}/agents/${encodeURIComponent(canonicalName)}`);
  }

  const timeline = await listAuditTimeline(
    workspace.id,
    { agentName: canonicalName },
    TIMELINE_LIMIT,
  );

  return (
    <AgentTimeline
      workspaceSlug={workspace.slug}
      agentName={canonicalName}
      entries={timeline}
    />
  );
}
