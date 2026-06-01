import Link from "next/link";
import type { ReactNode } from "react";

import { SidebarNavItem } from "@/components/sidebar-nav-item";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { toolkitLabel } from "@/lib/composio";
import { getMcpProvider } from "@/lib/mcp-providers";
import { getInstanceName } from "@/lib/instance-settings";
import { isInstanceAdminEmail } from "@/lib/instance";
import type { Workspace } from "@/lib/workspace";
import {
  IconAgent,
  IconApiConnection,
  IconCalendarRepeat,
  IconChatBubbles,
  IconDashboardMiddle,
  IconExclamationTriangle,
  IconHammer,
  IconHistory,
  IconSettingsSliderHor,
  IconShield,
} from "central-icons";

// Layout shell shared by every signed-in workspace route. Modeled on
// Tembo's apps/web sidebar pattern — fixed-width left rail, top bar
// owned by the page, content in a scrollable column. Intentionally
// slimmer than the full @tembo/ui Sidebar primitive (no collapse,
// no mobile drawer, no keyboard shortcuts) — those can land later
// once we have routes that justify the surface area.

type MissingConnection = {
  toolkit: string;
  /** Named slot — "default" or a user-chosen alias like "work". */
  name: string;
  agentName: string;
  /** Which substrate the agent's entry targets. Drives the authorize
   *  URL and the displayed label — Composio + Native MCP have
   *  separate connection sets per user. */
  source: "composio" | "native-mcp";
};

type FailingAgentAlert = {
  agentName: string;
  failures: number;
  /** ISO string so the prop is plain-data crossable. */
  lastFailureAtIso: string;
};

type Props = {
  workspace: Workspace;
  workspaces: { slug: string; name: string }[];
  user: { name?: string | null; email: string };
  /**
   * (toolkit, agent) pairs where an agent in this workspace declared
   * a Composio toolkit the workspace hasn't authorized. Rendered as
   * a list of "Connect X for Y" alerts in the sidebar — clicking
   * jumps to Settings → Connections so the user can authorize.
   */
  missingConnections: MissingConnection[];
  /**
   * Agents that have failed at least once in the last 24h. Rendered
   * above the missing-connection alerts so the loudest signal
   * (something broke recently) leads. Capped upstream so the rail
   * doesn't grow unbounded.
   */
  failingAgents: FailingAgentAlert[];
  children: ReactNode;
};

export async function AppShell({
  workspace,
  workspaces,
  user,
  missingConnections,
  failingAgents,
  children,
}: Props) {
  const instanceName = await getInstanceName();
  const isInstanceAdmin = isInstanceAdminEmail(user.email);
  const home = `/${workspace.slug}`;

  return (
    <div className="bg-surface flex min-h-screen">
      {/* sticky h-screen so the sidebar stays put while the main
          column scrolls — user menu always reachable at the bottom
          regardless of how tall the content gets. Inner nav scrolls
          on overflow rather than pushing the footer off-screen. */}
      <aside className="bg-surface-secondary border-border sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r">
        {/* py-3 matches the TopBar height. Whitespace, not borders,
            does the visual separation between sections — keeps the
            sidebar quieter so the Action needed cards (when present)
            land as the loudest thing in the rail. */}
        <div className="flex flex-col gap-0.5 px-3 py-3">
          <span className="text-foreground-muted text-sm font-medium uppercase tracking-widest">
            {instanceName}
          </span>
          <WorkspaceSwitcher
            current={{ slug: workspace.slug, name: workspace.name }}
            workspaces={workspaces}
            canCreateWorkspace={isInstanceAdmin}
          />
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3 pt-6">
          <SidebarNavItem
            href={`${home}/dashboard`}
            label="Dashboard"
            icon={<IconDashboardMiddle />}
          />
          <SidebarNavItem
            href={`${home}/runs`}
            label="Runs"
            icon={<IconHistory />}
          />
          <SidebarNavItem
            href={home}
            label="Agents"
            icon={<IconAgent />}
            matchPrefix
          />
          <SidebarNavItem
            href={`${home}/automations`}
            label="Automations"
            icon={<IconCalendarRepeat />}
          />
          <SidebarNavItem
            href={`${home}/connections`}
            label="Connections"
            icon={<IconApiConnection />}
          />
          <SidebarNavItem
            href={`${home}/tools`}
            label="Tools"
            icon={<IconHammer />}
          />
          <SidebarNavItem
            href={`${home}/improvements`}
            label="Improvements"
            icon={<IconChatBubbles />}
          />
          <SidebarNavItem
            href={`${home}/audit`}
            label="Audit"
            icon={<IconShield />}
          />
          <SidebarNavItem
            href={`${home}/settings`}
            label="Settings"
            icon={<IconSettingsSliderHor />}
          />

          {(failingAgents.length > 0 || missingConnections.length > 0) && (
            <div className="mt-6 flex flex-col gap-1.5">
              <span className="text-foreground-muted px-2 text-xs font-medium uppercase tracking-widest">
                Action needed
              </span>
              {failingAgents.map((f) => {
                const agentHref = `/${workspace.slug}/agents/${encodeURIComponent(f.agentName)}`;
                return (
                  <div
                    key={`fail:${f.agentName}`}
                    className="flex items-start gap-2 rounded-md bg-[var(--color-input-error)] px-2 py-2"
                  >
                    <IconExclamationTriangle
                      size={14}
                      className="text-sentiment-negative mt-0.5 shrink-0"
                    />
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                      <span className="text-sentiment-negative text-xs leading-tight">
                        <span className="font-semibold">{f.agentName}</span>{" "}
                        failed{" "}
                        <span className="font-semibold">{f.failures}×</span> in
                        24h
                      </span>
                      <Button asChild variant="orange" size="small">
                        <Link href={agentHref}>Open</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
              {missingConnections.map((m, i) => {
                // Authorize endpoint differs per substrate: Composio
                // is one route per workspace (toolkit in query
                // string), Native MCP is one route per provider
                // (provider in path). Sidebar dispatches by source
                // so the Connect button always lands on the right
                // OAuth flow.
                let authorizeHref: string;
                let providerLabel: string;
                if (m.source === "native-mcp") {
                  const params = new URLSearchParams({
                    workspace: workspace.slug,
                  });
                  if (m.name && m.name !== "default") {
                    params.set("name", m.name);
                  }
                  authorizeHref = `/api/connections/native/${m.toolkit}/authorize?${params.toString()}`;
                  providerLabel =
                    getMcpProvider(m.toolkit)?.displayName ?? m.toolkit;
                } else {
                  const params = new URLSearchParams({
                    workspace: workspace.slug,
                    toolkit: m.toolkit,
                  });
                  if (m.name && m.name !== "default") {
                    params.set("name", m.name);
                  }
                  authorizeHref = `/api/connections/composio/authorize?${params.toString()}`;
                  providerLabel = toolkitLabel(m.toolkit);
                }
                // Show "Gmail (work)" when the slot has a custom name
                // so the user can tell which account the agent
                // wants — otherwise just the provider label.
                const labelWithSlot =
                  m.name && m.name !== "default"
                    ? `${providerLabel} (${m.name})`
                    : providerLabel;
                return (
                  <div
                    key={`${m.toolkit}:${m.name}:${m.agentName}:${i}`}
                    className="flex items-start gap-2 rounded-md px-2 py-2 bg-[var(--color-sentiment-caution-subtle)]"
                  >
                    <IconExclamationTriangle
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--color-icon-sentiment-caution)]"
                    />
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                      <span className="text-xs leading-tight text-[var(--color-foreground-sentiment-caution)]">
                        <span className="font-semibold">{labelWithSlot}</span>{" "}
                        for{" "}
                        <span className="font-semibold">{m.agentName}</span>
                      </span>
                      <Button asChild variant="orange" size="small">
                        <Link href={authorizeHref}>Connect</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        <div className="px-2 py-2">
          <UserMenu
            name={user.name ?? null}
            email={user.email}
            isInstanceAdmin={isInstanceAdmin}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
