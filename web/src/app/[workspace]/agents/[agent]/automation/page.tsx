import { listAutomationsForAgent } from "@/lib/automations-api";
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
import { AutomationsSection } from "../automations-section";
import { TriggersSection } from "../triggers-section";
import { WebhooksSection } from "../webhooks-section";

export const dynamic = "force-dynamic";

// Automation tab — every way this agent fires on its own: Composio event
// triggers, inbound external webhooks, and cron schedules.

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

  return (
    <>
      <TriggersSection
        workspaceSlug={workspace.slug}
        agentName={canonicalName}
        triggers={triggers}
        myConnections={myConnections}
        composioApiKeyConfigured={!!composioApiKeyPreview}
        webhookSecretConfigured={!!composioWebhookSecretPreview}
      />

      <WebhooksSection
        workspaceSlug={workspace.slug}
        agentName={canonicalName}
        baseUrl={getPublicOrigin()}
        canManage={canEdit}
        owners={
          isAdmin
            ? allMembers.map((m) => ({
                userId: m.userId,
                label: m.name ?? m.email,
              }))
            : undefined
        }
        webhooks={webhooks.map((w) => ({
          id: w.id,
          name: w.name,
          tokenLast4: w.tokenLast4,
          enabled: w.enabled,
          lastFiredAtIso: w.lastFiredAt ? w.lastFiredAt.toISOString() : null,
          lastFireError: w.lastFireError,
        }))}
      />

      <AutomationsSection
        automations={automations}
        workspaceSlug={workspace.slug}
        agentName={canonicalName}
      />
    </>
  );
}
