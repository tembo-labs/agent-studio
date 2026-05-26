import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { listComposioConnectionsForWorkspace } from "@/lib/composio-connections";
import { getServerSession } from "@/lib/session";
import { listAgents } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  listWorkspacesForUser,
  touchWorkspaceLastVisited,
  userIsMember,
} from "@/lib/workspace";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspace: string }>;
}): Promise<Metadata> {
  const { workspace: slug } = await params;
  // Point at our favicon route handler — the handler resolves the
  // workspace's chosen default or streams the custom blob. We deliberately
  // don't await getWorkspaceBySlug here just to read favicon_kind because
  // the handler does that for itself; this keeps metadata generation fast.
  const href = `/api/workspaces/${encodeURIComponent(slug)}/favicon`;
  return {
    icons: { icon: href, shortcut: href, apple: href },
  };
}

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  // Fire-and-forget last-visited bump so the "/" landing redirect
  // returns the user here next session. Doesn't block render.
  void touchWorkspaceLastVisited(workspace.id, session.user.id);

  // Compute "Connect X for agent Y" alerts the sidebar surfaces when
  // an agent declares a Composio toolkit the workspace hasn't
  // authorized yet. Without this, users on /agents or /runs would
  // only discover the gap when an agent fails to run.
  //
  // Both fetches are tolerated to fail (no repo connected, invalid
  // GitHub token, Composio query error) — the sidebar just drops
  // the alerts section in that case rather than blocking page render.
  const [workspaces, agentsListing, composioConnections] = await Promise.all([
    listWorkspacesForUser(session.user.id),
    listAgents(workspace.id).catch(() => null),
    listComposioConnectionsForWorkspace(workspace.id).catch(() => []),
  ]);
  const switcherList = workspaces.map((w) => ({ slug: w.slug, name: w.name }));
  const activeToolkits = new Set(
    composioConnections
      .filter((c) => c.status === "ACTIVE")
      .map((c) => c.toolkit),
  );
  const missingConnections: { toolkit: string; agentName: string }[] = [];
  if (agentsListing && agentsListing.ok) {
    for (const a of agentsListing.agents) {
      if (!a.ok) continue;
      if (a.spec.framework !== "pydantic-agentspec") continue;
      for (const slug of a.spec.connections) {
        const normalized = slug.trim().toLowerCase();
        if (!normalized) continue;
        if (!activeToolkits.has(normalized)) {
          missingConnections.push({
            toolkit: normalized,
            agentName: a.spec.name,
          });
        }
      }
    }
  }

  return (
    <AppShell
      workspace={workspace}
      workspaces={switcherList}
      user={session.user}
      missingConnections={missingConnections}
    >
      {children}
    </AppShell>
  );
}
