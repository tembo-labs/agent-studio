import Link from "next/link";

import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { listAutomationsForAgent } from "@/lib/automations-api";
import { toolkitLabel } from "@/lib/composio";
import { listConnectionsForUser } from "@/lib/composio-connections";
import { getPublicOrigin } from "@/lib/config";
import { meetsMinRole } from "@/lib/rbac";
import { listTriggersForAgent } from "@/lib/triggers-db";
import { listWebhooksForAgent } from "@/lib/webhooks-db";
import {
  getWorkspaceRole,
  getWorkspaceSecretPreview,
  listWorkspaceMembers,
} from "@/lib/workspace";

import { loadAgentContext } from "../agent-page-context";
import {
  AgentAutomationsTable,
  type AgentAutomationRow,
} from "../agent-automations-table";
import { TriggerForm } from "../trigger-form";
import { AddWebhookForm } from "../webhooks-section";

export const dynamic = "force-dynamic";

// Automation tab — every way this agent fires on its own: cron schedules,
// Composio event triggers, and inbound external webhooks.

export default async function AgentAutomationPage({
  params,
}: {
  params: Promise<{ workspace: string; agent: string }>;
}) {
  const { workspace: slug, agent: agentName } = await params;
  const { session, workspace, canonicalName } = await loadAgentContext(
    slug,
    agentName,
  );

  const [
    triggers,
    webhooks,
    automations,
    myConnections,
    composioApiKeyPreview,
    composioWebhookSecretPreview,
    currentUserRole,
    allMembers,
  ] = await Promise.all([
    listTriggersForAgent(workspace.id, canonicalName),
    listWebhooksForAgent(workspace.id, canonicalName),
    listAutomationsForAgent(workspace.id, canonicalName),
    listConnectionsForUser(workspace.id, session.user.id),
    getWorkspaceSecretPreview(workspace.id, "composio_api_key"),
    getWorkspaceSecretPreview(workspace.id, "composio_webhook_secret"),
    getWorkspaceRole(workspace.id, session.user.id),
    listWorkspaceMembers(workspace.id),
  ]);

  const canEdit = meetsMinRole(currentUserRole, "operator");
  const isAdmin = currentUserRole === "workspace_admin";
  const baseUrl = getPublicOrigin();
  const memberLabel = new Map(
    allMembers.map((m) => [m.userId, m.name ?? m.email]),
  );
  const runAsOf = (userId: string) => memberLabel.get(userId) ?? "—";
  const owners = isAdmin
    ? allMembers.map((m) => ({
        userId: m.userId,
        label: m.name ?? m.email,
      }))
    : undefined;

  const rows: AgentAutomationRow[] = [
    ...automations.map((a): AgentAutomationRow => ({
      id: a.id,
      kind: "schedule",
      name: a.name,
      runAs: a.ownerUserName ?? a.ownerUserEmail ?? "—",
      enabled: a.enabled,
      lastFiredAtIso: a.lastFiredAt ? a.lastFiredAt.toISOString() : null,
      lastFireError: a.lastFireError,
      href: `/${workspace.slug}/automations/${a.id}`,
      cron: a.cron,
    })),
    ...triggers.map((t): AgentAutomationRow => ({
      id: t.id,
      kind: "trigger",
      name: t.triggerType,
      runAs: runAsOf(t.userId),
      enabled: t.enabled,
      lastFiredAtIso: t.lastFiredAt ? t.lastFiredAt.toISOString() : null,
      lastFireError: t.lastFireError,
      href: null,
      toolkitSlug: t.toolkitSlug,
      triggerType: t.triggerType,
    })),
    ...webhooks.map((w): AgentAutomationRow => ({
      id: w.id,
      kind: "webhook",
      name: w.name,
      runAs: runAsOf(w.ownerUserId),
      enabled: w.enabled,
      lastFiredAtIso: w.lastFiredAt ? w.lastFiredAt.toISOString() : null,
      lastFireError: w.lastFireError,
      href: null,
      tokenLast4: w.tokenLast4,
      webhookUrl: `${baseUrl}/api/hooks/webhook/${w.id}`,
    })),
  ];

  return (
    <>
      <Section
        title="Automations"
        description="Every way this agent fires on its own: schedules, event triggers, and inbound webhooks."
        actions={
          <Button asChild variant="secondary">
            <Link
              href={`/${workspace.slug}/automations/new?agent=${encodeURIComponent(canonicalName)}`}
            >
              New schedule
            </Link>
          </Button>
        }
      >
        <AgentAutomationsTable
          rows={rows}
          workspaceSlug={workspace.slug}
          canManageWebhooks={canEdit}
        />
      </Section>

      <Section
        collapsible
        title="Add event trigger"
        description="Subscribe this agent to events from connected services."
      >
        {!composioApiKeyPreview && (
          <PreconditionNotice
            tone="alert"
            text="Set a Composio API key in Settings before creating triggers."
          />
        )}
        {composioApiKeyPreview && !composioWebhookSecretPreview && (
          <PreconditionNotice
            tone="warn"
            text="Add a Composio webhook secret in Settings so inbound events can be verified."
          />
        )}
        <TriggerForm
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
          connections={myConnections.map((c) => ({
            id: c.id,
            toolkit: c.toolkit,
            name: c.name,
            label: `${toolkitLabel(c.toolkit)} · ${c.name}`,
          }))}
          disabled={!composioApiKeyPreview}
        />
      </Section>

      {canEdit && (
        <Section
          collapsible
          title="Add webhook"
          description="Create an inbound HTTP endpoint that fires this agent."
        >
          <AddWebhookForm
            workspaceSlug={workspace.slug}
            agentName={canonicalName}
            owners={owners}
          />
        </Section>
      )}
    </>
  );
}

function PreconditionNotice({
  tone,
  text,
}: {
  tone: "warn" | "alert";
  text: string;
}) {
  const styles =
    tone === "alert"
      ? "border-sentiment-negative bg-[var(--color-input-error)]"
      : "border-[var(--color-border-sentiment-caution)] bg-[var(--color-sentiment-caution-subtle)]";
  return (
    <div className={`mb-3 rounded-lg border px-3 py-2 text-sm ${styles}`}>
      <span className="text-foreground">{text}</span>
    </div>
  );
}
