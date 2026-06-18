import { notFound } from "next/navigation";

import { getServerSession } from "@/lib/session";
import { listTriggersForWorkspace } from "@/lib/triggers-db";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { AutomationsShell } from "../automations-shell";
import { TriggersTable, type TriggerRow } from "./triggers-table";

export const dynamic = "force-dynamic";

// Workspace-wide view of Composio event triggers. Read overview — create and
// manage them on the owning agent's Automation tab.

export default async function WorkspaceTriggersPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const triggers = await listTriggersForWorkspace(workspace.id);

  const rows: TriggerRow[] = triggers.map((t) => ({
    id: t.id,
    agentName: t.agentName,
    toolkitSlug: t.toolkitSlug,
    triggerType: t.triggerType,
    enabled: t.enabled,
    lastFiredAtIso: t.lastFiredAt ? t.lastFiredAt.toISOString() : null,
    lastFireError: t.lastFireError,
    agentAutomationHref: `/${slug}/agents/${encodeURIComponent(t.agentName)}/automation`,
  }));

  return (
    <AutomationsShell workspaceSlug={workspace.slug}>
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground-title text-base font-bold">Triggers</h2>
        <p className="text-foreground-weak text-sm">
          Composio event triggers fire an agent when something happens in a
          connected app. Manage them on an agent&apos;s Automation tab.
        </p>
      </div>

      <TriggersTable
        rows={rows}
        empty={
          <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
            No event triggers yet. Add one from an agent&apos;s Automation tab.
          </p>
        }
      />
    </AutomationsShell>
  );
}
