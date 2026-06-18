import { notFound } from "next/navigation";

import { getServerSession } from "@/lib/session";
import { listWebhooksForWorkspace } from "@/lib/webhooks-db";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { AutomationsShell } from "../automations-shell";
import { WebhooksTable, type WebhookRow } from "./webhooks-table";

export const dynamic = "force-dynamic";

// Workspace-wide view of inbound external webhooks. Read overview — create and
// manage (rotate token, etc.) on the owning agent's Automation tab.

export default async function WorkspaceWebhooksPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const webhooks = await listWebhooksForWorkspace(workspace.id);

  const rows: WebhookRow[] = webhooks.map((w) => ({
    id: w.id,
    agentName: w.agentName,
    name: w.name,
    tokenLast4: w.tokenLast4,
    enabled: w.enabled,
    lastFiredAtIso: w.lastFiredAt ? w.lastFiredAt.toISOString() : null,
    lastFireError: w.lastFireError,
    agentAutomationHref: `/${slug}/agents/${encodeURIComponent(w.agentName)}/automation`,
  }));

  return (
    <AutomationsShell workspaceSlug={workspace.slug}>
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground-title text-base font-bold">Webhooks</h2>
        <p className="text-foreground-weak text-sm">
          Inbound HTTP endpoints that fire an agent when an outside system POSTs
          to them. Manage them on an agent&apos;s Automation tab.
        </p>
      </div>

      <WebhooksTable
        rows={rows}
        empty={
          <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
            No webhooks yet. Add one from an agent&apos;s Automation tab.
          </p>
        }
      />
    </AutomationsShell>
  );
}
