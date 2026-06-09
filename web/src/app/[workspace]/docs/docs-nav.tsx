"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { IconChevronDownSmall, IconGithub, IconStar } from "central-icons";

import { DOC_SECTIONS, type DocGroup, type DocSection } from "./nav";

// Left rail for the in-app docs. Two audience sections (Operators / Admins),
// each a collapsible header over grouped pages. Everyone sees both; the Admins
// section starts collapsed. Three header tiers — UPPERCASE audience (with a
// chevron) › bold group heading › normal page links — keep them distinct.
// A GitHub stars link is pegged to the bottom.
export function DocsNav({
  workspaceSlug,
  repoUrl,
  starCount,
  version,
}: {
  workspaceSlug: string;
  repoUrl: string;
  starCount: number | null;
  version: string | null;
}) {
  const base = `/${workspaceSlug}/docs`;
  return (
    <nav
      aria-label="Documentation"
      className="flex h-full w-full flex-col sm:w-60"
    >
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto pb-3">
        {DOC_SECTIONS.map((section, idx) => (
          <AudienceSection
            key={section.audience}
            section={section}
            base={base}
            defaultOpen={idx === 0}
          />
        ))}
      </div>

      <a
        href={repoUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="text-foreground-weak hover:bg-surface hover:text-foreground mt-2 flex shrink-0 items-center gap-2 border-t border-[var(--color-border-weak)] px-2 pt-3 text-sm"
      >
        <IconGithub size={15} />
        <span>GitHub</span>
        {starCount !== null && (
          <span className="text-foreground-muted ml-auto inline-flex items-center gap-1 tabular-nums">
            <IconStar size={13} />
            {formatStars(starCount)}
          </span>
        )}
      </a>
      {version && (
        <span className="text-foreground-muted px-2 pt-1 text-[11px]">
          {version}
        </span>
      )}
    </nav>
  );
}

function formatStars(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
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
        <div className="mt-1 flex flex-col gap-2">
          {section.groups.map((group) => (
            <GroupSection key={group.label} group={group} base={base} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupSection({ group, base }: { group: DocGroup; base: string }) {
  const pathname = usePathname();
  const hasActive = group.items.some((i) => pathname === `${base}/${i.slug}`);
  const [userOpen, setUserOpen] = useState(true);
  const open = userOpen || hasActive;

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setUserOpen((o) => !o)}
        aria-expanded={open}
        className="text-foreground-weak hover:text-foreground flex items-center justify-between gap-2 border-b border-[var(--color-border-weak)] px-2 pb-1 text-xs font-semibold transition-colors"
      >
        <span>{group.label}</span>
        <IconChevronDownSmall
          aria-hidden
          className={cn(
            "text-foreground-muted h-3 w-3 transition-transform",
            open ? "" : "-rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 pt-0.5">
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
      )}
    </div>
  );
}
