import { notFound } from "next/navigation";
import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { getServerSession } from "@/lib/session";
import { listWebhooksForWorkspace } from "@/lib/webhooks-db";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { AutomationsShell } from "../automations-shell";

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

  return (
    <AutomationsShell workspaceSlug={workspace.slug}>
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground-title text-base font-bold">Webhooks</h2>
        <p className="text-foreground-weak text-sm">
          Inbound HTTP endpoints that fire an agent when an outside system POSTs
          to them. Manage them on an agent&apos;s Automation tab.
        </p>
      </div>

      {webhooks.length === 0 ? (
        <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
          No webhooks yet. Add one from an agent&apos;s Automation tab.
        </p>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-foreground-weak text-sm uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Agent</th>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Token</th>
                <th className="px-3 py-2 text-left font-medium">Last fired</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-weak)]">
              {webhooks.map((w) => (
                <tr key={w.id} className="bg-surface-raised">
                  <td className="px-3 py-2 align-top">
                    <Link
                      href={`/${slug}/agents/${encodeURIComponent(w.agentName)}/automation`}
                      className="text-foreground font-medium hover:underline"
                    >
                      {w.agentName}
                    </Link>
                  </td>
                  <td className="text-foreground px-3 py-2 align-top">{w.name}</td>
                  <td className="text-foreground-muted px-3 py-2 align-top font-mono text-sm">
                    ••••{w.tokenLast4}
                  </td>
                  <td className="text-foreground-weak px-3 py-2 align-top text-sm">
                    {w.lastFiredAt ? (
                      <LocalTime
                        iso={w.lastFiredAt.toISOString()}
                        style="relative"
                      />
                    ) : (
                      <span className="text-foreground-muted">Never</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {!w.enabled ? (
                      <Badge variant="gray" size="small">
                        Disabled
                      </Badge>
                    ) : w.lastFireError ? (
                      <Badge variant="red" size="small">
                        Error
                      </Badge>
                    ) : (
                      <Badge variant="green" size="small">
                        Enabled
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AutomationsShell>
  );
}
