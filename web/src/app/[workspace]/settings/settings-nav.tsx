"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Left rail for the Settings shell. Five sub-pages, sorted by how
// often an operator opens them (API keys lead, danger-zone-ish
// "deleted agents" trails). Active item highlights on prefix-match
// so a nested sub-route in the future doesn't need a separate
// special case.

type Item = { slug: string; label: string };

const ITEMS: Item[] = [
  { slug: "api-keys", label: "API keys" },
  { slug: "repository", label: "Repository" },
  { slug: "appearance", label: "Appearance" },
  { slug: "members", label: "Members" },
  { slug: "deleted-agents", label: "Deleted agents" },
];

export function SettingsNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const base = `/${workspaceSlug}/settings`;

  return (
    <nav
      aria-label="Settings sections"
      className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto sm:w-52 sm:flex-col"
    >
      {ITEMS.map((item) => {
        const href = `${base}/${item.slug}`;
        // active when current path starts with this href, OR (for
        // the API-keys default) when the user is on bare /settings
        const isActive =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          (pathname === base && item.slug === "api-keys");
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
