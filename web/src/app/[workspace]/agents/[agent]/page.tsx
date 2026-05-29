import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FRAMEWORK_LABELS } from "@/lib/agent-framework";
import { listAuditTimeline } from "@/lib/audit-db";
import {
  listAutomationsForAgent,
  type Automation,
} from "@/lib/automations-api";
import { listConnectionsForUser } from "@/lib/composio-connections";
import { nextFireAfter, validateCron } from "@/lib/cron";
import { meetsMinRole } from "@/lib/rbac";
import {
  getAgentDailyRuns30d,
  getAgentStats30d,
  listAgentFailureGroups30d,
  listRecentRunsForAgent,
  type RunSummary,
} from "@/lib/runs-db";
import { getServerSession } from "@/lib/session";
import { listTriggersForAgent } from "@/lib/triggers-db";
import { getAgentByName } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  getWorkspaceRole,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { AgentDashboard } from "./agent-dashboard";
import { AgentTimeline } from "./agent-timeline";
import { DeleteAgentButton } from "./delete-agent-button";
import { RunNowButton } from "./run-now-button";
import { TriggersSection } from "./triggers-section";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string }>;
}) {
  const { workspace: slug, agent: agentName } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    redirect(`/onboarding/repo?ws=${encodeURIComponent(workspace.slug)}`);
  }

  const result = await getAgentByName(workspace.id, agentName);
  if (!result) notFound();
  const { agent, raw } = result;
  const canonicalName = agent.ok ? agent.spec.name : agentName;

  const [
    recentRuns,
    automations,
    stats,
    daily,
    failures,
    triggers,
    myConnections,
    composioApiKeyPreview,
    composioWebhookSecretPreview,
    timeline,
    currentUserRole,
  ] = await Promise.all([
    listRecentRunsForAgent(workspace.id, canonicalName, 10),
    listAutomationsForAgent(workspace.id, canonicalName),
    getAgentStats30d(workspace.id, canonicalName),
    getAgentDailyRuns30d(workspace.id, canonicalName),
    listAgentFailureGroups30d(workspace.id, canonicalName, 5),
    listTriggersForAgent(workspace.id, canonicalName),
    listConnectionsForUser(workspace.id, session.user.id),
    getWorkspaceSecretPreview(workspace.id, "composio_api_key"),
    getWorkspaceSecretPreview(workspace.id, "composio_webhook_secret"),
    listAuditTimeline(workspace.id, { agentName: canonicalName }, 20),
    getWorkspaceRole(workspace.id, session.user.id),
  ]);
  const canEdit = meetsMinRole(currentUserRole, "operator");

  const sourceHref = `https://github.com/${repo.owner}/${repo.name}/blob/${repo.defaultBranch}/${agent.path}`;

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
                <Badge variant="blue" size="small">
                  {FRAMEWORK_LABELS[agent.spec.framework]}
                </Badge>
                <Badge variant="purple" size="small">
                  {agent.spec.model ?? "—"}
                </Badge>
                <code className="text-foreground-muted text-sm">
                  {agent.filename}
                </code>
              </div>
            ) : (
              <p className="text-sentiment-negative text-sm">
                Invalid agent: {agent.error}
                {agent.detail ? ` — ${agent.detail}` : ""}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost">
              <a href={sourceHref} target="_blank" rel="noreferrer noopener">
                View source
              </a>
            </Button>
            {agent.ok && canEdit && (
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
            {agent.ok && canEdit && (
              <RunNowButton
                workspaceSlug={workspace.slug}
                agentName={canonicalName}
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

      <hr className="border-[var(--color-border-weak)]" />

      <div className="flex flex-col gap-8">
        <AgentDashboard
          stats={stats}
          daily={daily}
          failures={failures}
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
        />

        <TriggersSection
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
          triggers={triggers}
          myConnections={myConnections}
          composioApiKeyConfigured={!!composioApiKeyPreview}
          webhookSecretConfigured={!!composioWebhookSecretPreview}
        />

        <AutomationsSection
          automations={automations}
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
        />

        <Section
          title="Recent runs"
          description={
            recentRuns.length === 0
              ? undefined
              : `Last ${recentRuns.length} run${recentRuns.length === 1 ? "" : "s"}.`
          }
        >
          <RecentRuns
            runs={recentRuns}
            workspaceSlug={workspace.slug}
            agentName={canonicalName}
          />
        </Section>

        <AgentTimeline
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
          entries={timeline}
        />

        <Section
          title="Definition"
          description="Edits go through Git. Framework and model changes go through the same review path as any other change — never edited in a live console."
        >
          <pre className="bg-surface border-border text-foreground overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-5">
            {raw}
          </pre>
        </Section>
      </div>
    </div>
  );
}

function RecentRuns({
  runs,
  workspaceSlug,
  agentName,
}: {
  runs: RunSummary[];
  workspaceSlug: string;
  agentName: string;
}) {
  if (runs.length === 0) {
    return (
      <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
        No runs yet. Click <strong className="text-foreground">Run now</strong>{" "}
        above.
      </p>
    );
  }
  return (
    <ul className="divide-border flex flex-col divide-y border-y border-[var(--color-border)]">
      {runs.map((run) => {
        const tone = STATUS_TONE[run.status];
        return (
          <li
            key={run.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <Link
              href={`/${workspaceSlug}/agents/${encodeURIComponent(agentName)}/runs/${run.id}`}
              className="flex flex-1 items-center gap-3"
            >
              <Badge variant={tone.variant} size="small">
                {STATUS_LABELS[run.status]}
              </Badge>
              {run.trigger === "schedule" && (
                <Badge variant="blue" size="small">
                  Scheduled
                </Badge>
              )}
              {run.trigger === "event" && (
                <Badge variant="purple" size="small">
                  Event
                </Badge>
              )}
              <LocalTime
                iso={run.createdAt.toISOString()}
                className="text-foreground-muted text-sm"
              />
            </Link>
            <Link
              href={`/${workspaceSlug}/agents/${encodeURIComponent(agentName)}/runs/${run.id}`}
              className="text-foreground-weak hover:text-foreground text-xs"
            >
              Open →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AutomationsSection({
  automations,
  workspaceSlug,
  agentName,
}: {
  automations: Automation[];
  workspaceSlug: string;
  agentName: string;
}) {
  // The "New automation" link is in the Section header (right side)
  // so the affordance is visible even when the list is empty.
  const newHref = `/${workspaceSlug}/automations/new?agent=${encodeURIComponent(agentName)}`;
  return (
    <Section
      title="Automations"
      description="Schedules that fire this agent on their own. Cron is UTC; times shown are local."
      actions={
        <Button asChild variant="secondary">
          <Link href={newHref}>New automation</Link>
        </Button>
      }
    >
      {automations.length === 0 ? (
        <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
          No automations yet. Click <strong className="text-foreground">New
          automation</strong> to schedule this agent.
        </p>
      ) : (
        <ul className="divide-border flex flex-col divide-y border-y border-[var(--color-border)]">
          {automations.map((a) => {
            const preview = validateCron(a.cron);
            const next = a.enabled ? nextFireAfter(a.cron, new Date()) : null;
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <Link
                  href={`/${workspaceSlug}/automations/${a.id}`}
                  className="flex flex-1 min-w-0 items-center gap-3"
                >
                  {a.enabled ? (
                    a.lastFireError ? (
                      <Badge variant="red" size="small">
                        Error
                      </Badge>
                    ) : (
                      <Badge variant="green" size="small">
                        On
                      </Badge>
                    )
                  ) : (
                    <Badge variant="gray" size="small">
                      Off
                    </Badge>
                  )}
                  <span className="text-foreground truncate text-sm font-medium">
                    {a.name}
                  </span>
                  <span className="text-foreground-weak truncate text-xs">
                    {preview.ok ? preview.humanReadable : a.cron}{" "}
                    <span className="text-foreground-muted">(UTC)</span>
                  </span>
                </Link>
                <span className="text-foreground-muted shrink-0 text-xs">
                  {next ? (
                    <>
                      Next{" "}
                      <LocalTime
                        iso={next.toISOString()}
                        className="text-foreground-weak"
                      />
                    </>
                  ) : a.enabled ? (
                    "—"
                  ) : (
                    "Paused"
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

const STATUS_LABELS: Record<RunSummary["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

const STATUS_TONE: Record<
  RunSummary["status"],
  { variant: "blue" | "yellow" | "green" | "red" }
> = {
  queued: { variant: "yellow" },
  running: { variant: "blue" },
  succeeded: { variant: "green" },
  failed: { variant: "red" },
};
