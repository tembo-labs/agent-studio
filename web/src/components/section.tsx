import type { ReactNode } from "react";

import { IconChevronDownSmall } from "central-icons";

// Tembo's DashboardSection-style flat section header — small bold title,
// weak description, optional right-aligned actions. Replaces the heavier
// Card wrappers we were leaning on for every grouping.
//
// Optionally `collapsible`: renders as a native <details> (no client JS) so a
// section can start collapsed — used for secondary, form-heavy sections like
// Triggers / External webhooks that would otherwise clutter the agent page.

type Props = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Tighten vertical rhythm when used inline inside another section. */
  inset?: boolean;
  /** Render as a collapsible <details>. */
  collapsible?: boolean;
  /** When collapsible, whether it starts expanded. Default collapsed. */
  defaultOpen?: boolean;
};

export function Section({
  title,
  description,
  actions,
  children,
  inset,
  collapsible,
  defaultOpen = false,
}: Props) {
  const gap = inset ? "flex flex-col gap-2" : "flex flex-col gap-3";

  if (collapsible) {
    return (
      <details className={`group ${gap}`} open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-end justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 flex-col">
            <h2 className="text-foreground-title flex items-center gap-1.5 text-base font-bold">
              <IconChevronDownSmall
                aria-hidden
                className="text-foreground-muted h-4 w-4 -rotate-90 transition-transform group-open:rotate-0"
              />
              {title}
            </h2>
            {description && (
              <p className="text-foreground-weak pl-[1.375rem] text-base">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </summary>
        <div>{children}</div>
      </details>
    );
  }

  return (
    <section className={gap}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-foreground-title text-base font-bold">{title}</h2>
          {description && (
            <p className="text-foreground-weak text-base">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}
