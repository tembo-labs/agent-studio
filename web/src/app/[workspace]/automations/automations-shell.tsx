import type { ReactNode } from "react";

import { AutomationsNav } from "./automations-nav";

// Two-column shell for the Automations list pages (Schedules / Triggers /
// Webhooks) — same shape as Connections/Settings. The schedule create/edit
// subroutes keep their own full-page layout, so this is used per list page
// rather than as a Next layout.
export function AutomationsShell({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Automations
        </h1>
        <p className="text-foreground-weak text-base">
          Every way agents in this workspace fire on their own — schedules,
          event triggers, and inbound webhooks.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
        <AutomationsNav workspaceSlug={workspaceSlug} />
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
