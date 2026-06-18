import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { getAgentLearning } from "@/lib/agent-learning-api";
import { getAgentSignalStats, listAgentLearningBatches } from "@/lib/inbox-api";
import { meetsMinRole } from "@/lib/rbac";
import { getWorkspaceRole } from "@/lib/workspace";

import { AgentLearningControl } from "../agent-learning-control";
import { loadAgentContext } from "../agent-page-context";
import { LearningHistoryTable, type LearningHistoryRow } from "./learning-history-table";

export const dynamic = "force-dynamic";

// Learning tab — the story of continuous learning for one agent: the config
// (on/off + cadence), what it's seen (signals: accepted vs corrected, pending),
// and the batches it has opened (each linked to its PR).

export default async function AgentLearningPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string }>;
}) {
  const { workspace: slug, agent: agentName } = await params;
  const { session, workspace, canonicalName } = await loadAgentContext(
    slug,
    agentName,
  );

  const [learning, stats, batches, role] = await Promise.all([
    getAgentLearning(workspace.id, canonicalName),
    getAgentSignalStats(workspace.id, canonicalName),
    listAgentLearningBatches(workspace.id, canonicalName),
    getWorkspaceRole(workspace.id, session.user.id),
  ]);
  const canEdit = meetsMinRole(role, "operator");
  const on = learning?.enabled ?? false;

  // Next cycle estimate: last run + cadence window (or "next tick" if never run).
  const nextRunIso =
    on && learning?.lastLearnedAt
      ? new Date(
          learning.lastLearnedAt.getTime() +
            (learning.cadence === "weekly" ? 7 : 1) * 86_400_000,
        ).toISOString()
      : null;

  return (
    <>
      <Section
        title="Learning mode"
        description="When on, the corrections you make to this agent's proposed actions in the Inbox are batched on a schedule into a single Tembo PR — so it handles more on its own over time, without a PR per correction."
      >
        <AgentLearningControl
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
          enabled={on}
          cadence={learning?.cadence ?? "daily"}
          canEdit={canEdit}
          lastLearnedAtIso={learning?.lastLearnedAt?.toISOString() ?? null}
        />
      </Section>

      <Section
        title="Signals"
        description="Every Inbox item this agent produced and you resolved is a learning signal. Corrections drive the next batch; accepted-as-is items confirm it got things right."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Resolved" value={stats.resolved} />
          <Stat label="Accepted as-is" value={stats.accepted} />
          <Stat label="Corrected" value={stats.corrected} />
          <Stat
            label="Pending next batch"
            value={stats.pending}
            hint={
              on
                ? stats.pendingCorrected > 0
                  ? `${stats.pendingCorrected} correction(s) queued${nextRunIso ? "" : " — runs next tick"}`
                  : "no corrections queued"
                : "learning off"
            }
          />
        </div>
        {on && nextRunIso && (
          <p className="text-foreground-muted mt-3 text-xs">
            Next cycle ~<LocalTime iso={nextRunIso} style="relative" />
            {stats.pendingCorrected === 0 && " (no PR unless there are corrections)"}
          </p>
        )}
      </Section>

      <Section
        title="Learning history"
        description="Each batch the learning pass opened, with the signals it folded in and the resulting PR."
      >
        {batches.length === 0 ? (
          <p className="text-foreground-weak text-sm">
            No learning batches yet. Once you correct this agent&apos;s Inbox
            proposals and a cycle runs, batched changes show up here.
          </p>
        ) : (
          <LearningHistoryTable
            rows={batches.map(
              (b): LearningHistoryRow => ({
                improvementId: b.improvementId,
                createdAtIso: b.createdAt.toISOString(),
                correctedCount: b.correctedCount,
                signalCount: b.signalCount,
                status: b.status,
                prUrl: b.prUrl,
                prNumber: b.prNumber,
                commitUrl: b.commitUrl,
                temboTaskHtmlUrl: b.temboTaskHtmlUrl,
              }),
            )}
          />
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="border-border bg-surface-raised flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <span className="text-foreground text-2xl font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-foreground-weak text-xs">{label}</span>
      {hint && <span className="text-foreground-muted text-xs">{hint}</span>}
    </div>
  );
}

