"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Left rail for the Automations area: the three ways an agent fires on its own,
// workspace-wide. Schedules is the index (`/automations`); the other two are
// read overviews that link back to the owning agent to manage.

type Item = { slug: string; label: string };

const ITEMS: Item[] = [
  { slug: "", label: "Schedules" },
  { slug: "triggers", label: "Triggers" },
  { slug: "webhooks", label: "Webhooks" },
];

export function AutomationsNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const base = `/${workspaceSlug}/automations`;

  return (
    <nav
      aria-label="Automation types"
      className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto sm:w-52 sm:flex-col"
    >
      {ITEMS.map((item) => {
        const href = item.slug ? `${base}/${item.slug}` : base;
        const isActive = item.slug
          ? pathname.startsWith(href)
          : pathname === base;
        return (
          <Link
            key={item.slug}
            href={href}
            className={
              isActive
                ? "bg-surface-secondary text-foreground rounded-md px-3 py-2 text-base font-medium"
                : "text-foreground-weak hover:bg-surface hover:text-foreground rounded-md px-3 py-2 text-base"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
