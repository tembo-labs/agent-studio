"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Left rail for the Connections shell. Two substrates, ordered so
// the default (Composio — widest coverage) leads. Native MCP gets
// the second slot since the catalog is small today but will grow as
// more providers ship official MCP servers.

type SubItem = { slug: string; label: string };
type Item = {
  slug: string;
  label: string;
  /** Indented child links shown only to workspace admins. */
  adminSub?: SubItem[];
};

const ITEMS: Item[] = [
  {
    slug: "native-mcp",
    label: "Native MCP",
    adminSub: [{ slug: "native-mcp/admin", label: "Manage providers" }],
  },
  { slug: "composio", label: "Composio" },
  { slug: "secrets", label: "Secrets" },
];

export function ConnectionsNav({
  workspaceSlug,
  isAdmin = false,
}: {
  workspaceSlug: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const base = `/${workspaceSlug}/connections`;

  return (
    <nav
      aria-label="Connection substrates"
      className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto sm:w-52 sm:flex-col"
    >
      {ITEMS.flatMap((item) => {
        const href = `${base}/${item.slug}`;
        const subs = isAdmin && item.adminSub ? item.adminSub : [];
        // A child route is active → keep the parent un-bolded so only one
        // row reads as current.
        const onSub = subs.some((s) =>
          pathname.startsWith(`${base}/${s.slug}`),
        );
        const isActive =
          !onSub &&
          (pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (pathname === base && item.slug === "native-mcp"));
        return [
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
          </Link>,
          ...subs.map((s) => {
            const subHref = `${base}/${s.slug}`;
            const subActive =
              pathname === subHref || pathname.startsWith(`${subHref}/`);
            return (
              <Link
                key={s.slug}
                href={subHref}
                className={
                  subActive
                    ? "bg-surface-secondary text-foreground rounded-md px-3 py-1.5 text-sm font-medium sm:ml-3"
                    : "text-foreground-weak hover:bg-surface hover:text-foreground rounded-md px-3 py-1.5 text-sm sm:ml-3"
                }
              >
                {s.label}
              </Link>
            );
          }),
        ];
      })}
    </nav>
  );
}
