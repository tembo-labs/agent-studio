import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/toaster";
import { listConnectionsForUser } from "@/lib/composio-connections";
import { listNativeConnectionsForUser } from "@/lib/connections";
import { listFailingAgents24h } from "@/lib/runs-db";
import { getServerSession } from "@/lib/session";
import { listAgents } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceSecretPreview,
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
  // Point at our favicon route handler — it resolves the workspace's
  // chosen default or streams the custom blob. Append a `?v=<kind>`
  // cache-buster: browsers cache favicons per-origin hard (a hard
  // refresh won't clear them), so without a changing URL a stale entry
  // (e.g. from before the icon was wired up, or the previous choice)
  // sticks. Keying on faviconKind changes the URL whenever the default
  // kind changes; custom uploads stay fresh via the route's
  // must-revalidate header.
  const ws = await getWorkspaceBySlug(slug);
  const v = ws ? encodeURIComponent(ws.faviconKind) : "default";
  const href = `/api/workspaces/${encodeURIComponent(slug)}/favicon?v=${v}`;
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
  // an agent declares a Composio toolkit the CURRENT user hasn't
  // authorized yet. Connections are now per-user (migration 0022),
  // so each member sees their own gaps — not the workspace's. Lets
  // a new team member know exactly which toolkits they need to
  // authorize themselves vs which their team has already covered.
  //
  // Both fetches are tolerated to fail (no repo, invalid GitHub
  // token, Composio query error) — the sidebar drops the alerts
  // section in that case rather than blocking page render.
  const [
    workspaces,
    agentsListing,
    myConnections,
    myNativeConnections,
    failingAgents,
    anthropicKey,
    openaiKey,
  ] = await Promise.all([
    listWorkspacesForUser(session.user.id),
    listAgents(workspace.id).catch(() => null),
    listConnectionsForUser(workspace.id, session.user.id).catch(() => []),
    listNativeConnectionsForUser(workspace.id, session.user.id).catch(() => []),
    listFailingAgents24h(workspace.id).catch(() => []),
    getWorkspaceSecretPreview(workspace.id, "anthropic_api_key").catch(
      () => null,
    ),
    getWorkspaceSecretPreview(workspace.id, "openai_api_key").catch(() => null),
  ]);
  // Agents run on the workspace's own provider keys; with neither set,
  // every run fails immediately. Surface a sidebar CTA so a new
  // workspace's first job is obvious.
  const hasLlmProvider = anthropicKey !== null || openaiKey !== null;
  const switcherList = workspaces.map((w) => ({ slug: w.slug, name: w.name }));
  // Two parallel slot sets — one per substrate. An agent's
  // `connections:` entry dispatches by its `source:` field, so a
  // native-mcp entry checks myNativeSlots and a composio entry
  // checks mySlots. Mixing them up was the bug that surfaced "Attio
  // for pipeline-report Connect" in the sidebar even after the user
  // had authorized Native MCP Attio.
  const mySlots = new Set(
    myConnections
      .filter((c) => c.status === "ACTIVE")
      .map((c) => `${c.toolkit}:${c.name}`),
  );
  const myNativeSlots = new Set(
    myNativeConnections
      .filter((c) => c.status === "active")
      .map((c) => `${c.type}:${c.name}`),
  );
  const missingConnections: {
    toolkit: string;
    name: string;
    agentName: string;
    source: "composio" | "native-mcp";
  }[] = [];
  if (agentsListing && agentsListing.ok) {
    for (const a of agentsListing.agents) {
      if (!a.ok) continue;
      if (a.spec.framework !== "pydantic-agentspec") continue;
      for (const conn of a.spec.connections) {
        const toolkit = conn.toolkit.trim().toLowerCase();
        const name = conn.name.trim().toLowerCase() || "default";
        if (!toolkit) continue;
        const slots = conn.source === "native-mcp" ? myNativeSlots : mySlots;
        if (!slots.has(`${toolkit}:${name}`)) {
          missingConnections.push({
            toolkit,
            name,
            agentName: a.spec.name,
            source: conn.source,
          });
        }
      }
    }
  }

  // Cap the failing-agents alert at 5 so the sidebar can't grow
  // unbounded if a workspace has many broken agents at once. The
  // full list lives on the workspace dashboard's "Top failing
  // agents" section.
  const failingAlerts = failingAgents.slice(0, 5).map((f) => ({
    agentName: f.agentName,
    failures: f.failures,
    lastFailureAtIso: f.lastFailureAt.toISOString(),
  }));

  return (
    <AppShell
      workspace={workspace}
      workspaces={switcherList}
      user={session.user}
      missingConnections={missingConnections}
      failingAgents={failingAlerts}
      hasLlmProvider={hasLlmProvider}
    >
      {children}
      <Toaster />
    </AppShell>
  );
}
