"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AgentsIcon } from "@/components/agents-icon";
import { SidebarNavItem } from "@/components/sidebar-nav-item";
import { cn } from "@/lib/utils";
import {
  IconApiConnection,
  IconBook,
  IconBulletList,
  IconCalendarRepeat,
  IconChatBubbles,
  IconChevronDownSmall,
  IconDashboardMiddle,
  IconHammer,
  IconHistory,
  IconSettingsSliderHor,
  IconShield,
} from "central-icons";

// Two-level workspace nav: a standalone Dashboard plus collapsible
// category groups (Build / Activity / Integrations / Workspace), modeled
// on Pylon's settings sidebar. Group open/closed state persists in
// localStorage; the group containing the current route auto-opens.

type NavLink = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Active for any sub-path (the /{slug} Agents home). */
  matchPrefix?: boolean;
};

type NavGroup = { id: string; label: string; items: NavLink[] };

export function SidebarNav({ home }: { home: string }) {
  const groups: NavGroup[] = [
    {
      id: "build",
      label: "Build",
      items: [
        { href: home, label: "Agents", icon: <AgentsIcon />, matchPrefix: true },
        {
          href: `${home}/automations`,
          label: "Automations",
          icon: <IconCalendarRepeat />,
        },
        {
          href: `${home}/improvements`,
          label: "Improvements",
          icon: <IconChatBubbles />,
        },
      ],
    },
    {
      id: "activity",
      label: "Activity",
      items: [
        { href: `${home}/runs`, label: "Runs", icon: <IconHistory /> },
        {
          href: `${home}/tool-uses`,
          label: "Tool uses",
          icon: <IconBulletList />,
        },
      ],
    },
    {
      id: "integrations",
      label: "Integrations",
      items: [
        {
          href: `${home}/connections`,
          label: "Connections",
          icon: <IconApiConnection />,
        },
        { href: `${home}/tools`, label: "Tools", icon: <IconHammer /> },
        { href: `${home}/skills`, label: "Skills", icon: <IconBook /> },
      ],
    },
    {
      id: "workspace",
      label: "Workspace",
      items: [
        { href: `${home}/audit`, label: "Audit", icon: <IconShield /> },
        {
          href: `${home}/settings`,
          label: "Settings",
          icon: <IconSettingsSliderHor />,
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-0.5">
      <SidebarNavItem
        href={`${home}/dashboard`}
        label="Dashboard"
        icon={<IconDashboardMiddle />}
      />
      {groups.map((g) => (
        <Group key={g.id} group={g} home={home} />
      ))}
    </div>
  );
}

function linkActive(item: NavLink, pathname: string, home: string): boolean {
  if (item.matchPrefix) {
    return pathname === home || pathname.startsWith(`${home}/agents`);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Group({ group, home }: { group: NavGroup; home: string }) {
  const pathname = usePathname();
  const hasActive = group.items.some((it) => linkActive(it, pathname, home));
  // The user's stored preference (default open). The group containing the
  // current route is always shown open (`open` below), so it reopens when
  // you navigate into a collapsed group without clobbering the preference.
  const [userOpen, setUserOpen] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(`tas-nav-${group.id}`);
    // Hydrate the persisted preference after mount (localStorage is
    // client-only; reading it in the initializer would mismatch SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored !== null) setUserOpen(stored === "open");
  }, [group.id]);

  const open = userOpen || hasActive;

  const toggle = () => {
    setUserOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem(`tas-nav-${group.id}`, next ? "open" : "closed");
      return next;
    });
  };

  return (
    <div className="mt-2 flex flex-col gap-0.5 border-t border-[var(--color-border-weak)] pt-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="text-foreground-muted hover:text-foreground flex items-center justify-between rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wider transition-colors"
      >
        <span>{group.label}</span>
        <IconChevronDownSmall
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open ? "" : "-rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5">
          {group.items.map((it) => (
            <SidebarNavItem
              key={it.href}
              href={it.href}
              label={it.label}
              icon={it.icon}
              matchPrefix={it.matchPrefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}
