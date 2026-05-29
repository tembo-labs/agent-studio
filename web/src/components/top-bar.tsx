import Link from "next/link";
import type { ReactNode } from "react";

import { IconChevronLeftSmall } from "central-icons";

type Crumb = { label: string; href?: string };

type Props = {
  /** Right-most segment (typed plain in the bar). The full trail is `crumbs`. */
  title: string;
  /** Optional ancestor crumbs rendered as clickable links left of the title. */
  crumbs?: Crumb[];
  /** Optional back link (renders a left-chevron pill). */
  back?: { href: string; label?: string };
  /** Right-aligned actions slot. */
  actions?: ReactNode;
  /** Optional subtitle / meta line under the title. */
  meta?: ReactNode;
};

export function TopBar({ title, crumbs, back, actions, meta }: Props) {
  return (
    <header className="border-border bg-surface sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-6 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {back && (
            <Link
              href={back.href}
              className="text-foreground-weak hover:text-foreground -ml-1 flex items-center gap-0.5 rounded-md px-1 py-0.5 text-sm"
              aria-label={back.label ?? "Back"}
            >
              <span className="flex h-4 w-4 items-center [&_svg]:h-4 [&_svg]:w-4">
                <IconChevronLeftSmall />
              </span>
            </Link>
          )}
          {crumbs?.map((c, i) => (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {c.href ? (
                <Link
                  href={c.href}
                  className="text-foreground-weak hover:text-foreground text-sm"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="text-foreground-weak text-base">{c.label}</span>
              )}
              <span className="text-foreground-muted text-sm">/</span>
            </span>
          ))}
          <h1 className="text-foreground-title text-sm font-semibold tracking-tight">
            {title}
          </h1>
        </div>
        {meta && <div className="text-foreground-weak text-sm">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
