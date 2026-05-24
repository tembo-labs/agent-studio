import type { ReactNode } from "react";

// Tembo's DashboardSection-style flat section header — small bold title,
// weak description, optional right-aligned actions. Replaces the heavier
// Card wrappers we were leaning on for every grouping.

type Props = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Tighten vertical rhythm when used inline inside another section. */
  inset?: boolean;
};

export function Section({
  title,
  description,
  actions,
  children,
  inset,
}: Props) {
  return (
    <section className={inset ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-foreground-title text-base font-bold">{title}</h2>
          {description && (
            <p className="text-foreground-weak text-sm">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}
