"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Left rail for the Connections shell. Two substrates, ordered so
// the default (Composio — widest coverage) leads. Native MCP gets
// the second slot since the catalog is small today but will grow as
// more providers ship official MCP servers.

type Item = { slug: string; label: string };

const ITEMS: Item[] = [
  { slug: "native-mcp", label: "Native MCP" },
  { slug: "composio", label: "Composio" },
];

export function ConnectionsNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const base = `/${workspaceSlug}/connections`;

  return (
    <nav
      aria-label="Connection substrates"
      className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto sm:w-52 sm:flex-col"
    >
      {ITEMS.map((item) => {
        const href = `${base}/${item.slug}`;
        const isActive =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          (pathname === base && item.slug === "native-mcp");
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
