"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Left rail for the agent view — mirrors settings-nav / connections-nav. One
// real route per tab. Drill-down pages (a run, a version) live under their
// tab's path, so the tab stays highlighted while you're inside them.

type Item = { slug: string; label: string };

const ITEMS: Item[] = [
  { slug: "", label: "Overview" },
  { slug: "runs", label: "Runs" },
  { slug: "automation", label: "Automation" },
  { slug: "versions", label: "Versions" },
  { slug: "definition", label: "Definition" },
  { slug: "activity", label: "Activity" },
  { slug: "learning", label: "Learning" },
  { slug: "settings", label: "Settings" },
];

export function AgentNav({
  workspaceSlug,
  agentName,
}: {
  workspaceSlug: string;
  agentName: string;
}) {
  const pathname = usePathname();
  const base = `/${workspaceSlug}/agents/${encodeURIComponent(agentName)}`;

  return (
    <nav
      aria-label="Agent sections"
      className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto sm:w-44 sm:flex-col"
    >
      {ITEMS.map((item) => {
        const href = item.slug ? `${base}/${item.slug}` : base;
        const isActive = item.slug
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === base;
        return (
          <Link
            key={item.slug || "overview"}
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
