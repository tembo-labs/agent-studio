"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { IconChevronDownSmall } from "central-icons";

import { DOC_SECTIONS, type DocSection } from "./nav";

// Left rail for the in-app docs. Two audience sections (Operators / Admins),
// each a collapsible header over grouped pages. Everyone sees both; the Admins
// section starts collapsed. Three header tiers — UPPERCASE audience (with a
// chevron) › bold group heading › normal page links — keep them distinct.
export function DocsNav({ workspaceSlug }: { workspaceSlug: string }) {
  const base = `/${workspaceSlug}/docs`;
  return (
    <nav
      aria-label="Documentation"
      className="flex w-full shrink-0 flex-col gap-1 sm:w-60"
    >
      {DOC_SECTIONS.map((section, idx) => (
        <AudienceSection
          key={section.audience}
          section={section}
          base={base}
          defaultOpen={idx === 0}
        />
      ))}
    </nav>
  );
}

function AudienceSection({
  section,
  base,
  defaultOpen,
}: {
  section: DocSection;
  base: string;
  defaultOpen: boolean;
}) {
  const pathname = usePathname();
  const [userOpen, setUserOpen] = useState(defaultOpen);
  // Always show the section that contains the current page (even if collapsed
  // by default), without clobbering the user's toggle preference.
  const hasActive = section.groups.some((g) =>
    g.items.some((i) => pathname === `${base}/${i.slug}`),
  );
  const open = userOpen || hasActive;

  return (
    <div className="border-[var(--color-border-weak)] pt-2 [&:not(:first-child)]:mt-1 [&:not(:first-child)]:border-t">
      <button
        type="button"
        onClick={() => setUserOpen((o) => !o)}
        aria-expanded={open}
        className="text-foreground-muted hover:text-foreground flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-widest transition-colors"
      >
        <span>{section.audience}</span>
        <IconChevronDownSmall
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open ? "" : "-rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="mt-1 flex flex-col gap-3">
          {section.groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <span className="text-foreground-weak px-2 text-xs font-semibold">
                {group.label}
              </span>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const href = `${base}/${item.slug}`;
                  const active = pathname === href;
                  return (
                    <Link
                      key={item.slug}
                      href={href}
                      className={
                        active
                          ? "bg-surface-secondary text-foreground ml-1 rounded-md px-2 py-1 text-sm font-medium"
                          : "text-foreground-weak hover:bg-surface hover:text-foreground ml-1 rounded-md px-2 py-1 text-sm"
                      }
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
