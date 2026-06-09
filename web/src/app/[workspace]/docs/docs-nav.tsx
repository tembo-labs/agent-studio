"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOC_SECTIONS } from "./nav";

// Left rail for the in-app docs: two audience sections (Operators / Admins),
// each with grouped pages. Everyone sees both. Mirrors the published manual's
// order.
export function DocsNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const base = `/${workspaceSlug}/docs`;

  return (
    <nav
      aria-label="Documentation"
      className="flex w-full shrink-0 flex-col gap-5 sm:w-60"
    >
      {DOC_SECTIONS.map((section) => (
        <div key={section.audience} className="flex flex-col gap-2">
          <span className="text-foreground-muted px-2 text-[11px] font-semibold uppercase tracking-widest">
            {section.audience}
          </span>
          {section.groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <span className="text-foreground-weak px-2 pt-1 text-sm font-medium">
                {group.label}
              </span>
              {group.items.map((item) => {
                const href = `${base}/${item.slug}`;
                const isActive = pathname === href;
                return (
                  <Link
                    key={item.slug}
                    href={href}
                    className={
                      isActive
                        ? "bg-surface-secondary text-foreground rounded-md px-2 py-1 text-sm font-medium"
                        : "text-foreground-weak hover:bg-surface hover:text-foreground rounded-md px-2 py-1 text-sm"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </nav>
  );
}
