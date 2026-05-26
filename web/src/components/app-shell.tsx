import Link from "next/link";
import type { ReactNode } from "react";

import { SidebarNavItem } from "@/components/sidebar-nav-item";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { toolkitLabel } from "@/lib/composio";
import { getInstanceName } from "@/lib/config";
import type { Workspace } from "@/lib/workspace";
import {
  IconAgent,
  IconCalendarRepeat,
  IconChatBubbles,
  IconDashboardMiddle,
  IconExclamationTriangle,
  IconHistory,
  IconSettingsSliderHor,
} from "central-icons";

// Layout shell shared by every signed-in workspace route. Modeled on
// Tembo's apps/web sidebar pattern — fixed-width left rail, top bar
// owned by the page, content in a scrollable column. Intentionally
// slimmer than the full @tembo/ui Sidebar primitive (no collapse,
// no mobile drawer, no keyboard shortcuts) — those can land later
// once we have routes that justify the surface area.

type MissingConnection = {
  toolkit: string;
  agentName: string;
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
  children: ReactNode;
};

export function AppShell({
  workspace,
  workspaces,
  user,
  missingConnections,
  children,
}: Props) {
  const instanceName = getInstanceName();
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
          <span className="text-foreground-muted text-[10px] font-medium uppercase tracking-widest">
            {instanceName}
          </span>
          <WorkspaceSwitcher
            current={{ slug: workspace.slug, name: workspace.name }}
            workspaces={workspaces}
          />
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3 pt-6">
          <SidebarNavItem
            href={`${home}/dashboard`}
            label="Dashboard"
            icon={<IconDashboardMiddle />}
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
            href={`${home}/runs`}
            label="Runs"
            icon={<IconHistory />}
          />
          <SidebarNavItem
            href={`${home}/improvements`}
            label="Improvements"
            icon={<IconChatBubbles />}
          />
          <SidebarNavItem
            href={`${home}/settings`}
            label="Settings"
            icon={<IconSettingsSliderHor />}
          />

          {missingConnections.length > 0 && (
            <div className="mt-6 flex flex-col gap-1.5">
              <span className="text-foreground-muted px-2 text-[10px] font-medium uppercase tracking-widest">
                Action needed
              </span>
              {missingConnections.map((m, i) => {
                const authorizeHref = `/api/connections/composio/authorize?workspace=${encodeURIComponent(workspace.slug)}&toolkit=${encodeURIComponent(m.toolkit)}`;
                return (
                  <div
                    key={`${m.toolkit}:${m.agentName}:${i}`}
                    className="flex items-center gap-2 rounded-md px-2 py-2 bg-[var(--color-sentiment-caution-subtle)]"
                  >
                    <IconExclamationTriangle
                      size={14}
                      className="shrink-0 text-[var(--color-icon-sentiment-caution)]"
                    />
                    <span className="min-w-0 flex-1 text-xs leading-tight text-[var(--color-foreground-sentiment-caution)]">
                      <span className="font-semibold">
                        {toolkitLabel(m.toolkit)}
                      </span>{" "}
                      for{" "}
                      <span className="font-semibold">{m.agentName}</span>
                    </span>
                    <Button asChild variant="orange" size="small">
                      <Link href={authorizeHref}>Connect</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        <div className="px-2 py-2">
          <UserMenu name={user.name ?? null} email={user.email} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
