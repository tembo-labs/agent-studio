import Link from "next/link";
import type { ReactNode } from "react";

import { SidebarNavItem } from "@/components/sidebar-nav-item";
import { UserMenu } from "@/components/user-menu";
import { getInstanceName } from "@/lib/config";
import type { Workspace } from "@/lib/workspace";
import { IconAgent, IconSettingsSliderHor } from "central-icons";

// Layout shell shared by every signed-in workspace route. Modeled on
// Tembo's apps/web sidebar pattern — fixed-width left rail, top bar
// owned by the page, content in a scrollable column. Intentionally
// slimmer than the full @tembo/ui Sidebar primitive (no collapse,
// no mobile drawer, no keyboard shortcuts) — those can land later
// once we have routes that justify the surface area.

type Props = {
  workspace: Workspace;
  user: { name?: string | null; email: string };
  children: ReactNode;
};

export function AppShell({ workspace, user, children }: Props) {
  const instanceName = getInstanceName();
  const home = `/${workspace.slug}`;

  return (
    <div className="bg-surface flex min-h-screen">
      <aside className="bg-surface-secondary border-border flex w-60 shrink-0 flex-col border-r">
        {/* py-3 matches the TopBar height; no bottom border — extra
            whitespace before the nav block does the visual separation. */}
        <div className="flex flex-col gap-0.5 px-3 py-3">
          <span className="text-foreground-muted text-[10px] font-medium uppercase tracking-widest">
            {instanceName}
          </span>
          <Link
            href={home}
            className="text-foreground-title hover:text-foreground text-sm font-semibold leading-tight"
          >
            {workspace.name}
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2 pb-3 pt-6">
          <SidebarNavItem
            href={home}
            label="Agents"
            icon={<IconAgent />}
            matchPrefix
          />
          <SidebarNavItem
            href={`${home}/settings`}
            label="Settings"
            icon={<IconSettingsSliderHor />}
          />
        </nav>

        <div className="border-border border-t px-2 py-2">
          <UserMenu name={user.name ?? null} email={user.email} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
