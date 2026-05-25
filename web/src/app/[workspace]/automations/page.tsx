import { notFound } from "next/navigation";
import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listAutomations, type Automation } from "@/lib/automations-api";
import { nextFireAfter, validateCron } from "@/lib/cron";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { ToggleEnabledForm } from "./toggle-enabled-form";

export const dynamic = "force-dynamic";

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const automations = await listAutomations(workspace.id);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
            Automations
          </h1>
          <p className="text-foreground-weak text-sm">
            Schedules and event triggers that fire agent runs on their own.
            Cron expressions are evaluated in UTC; the columns below render
            instants in your local time.
          </p>
        </div>
        <Button asChild>
          <Link href={`/${slug}/automations/new`}>New automation</Link>
        </Button>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {automations.length === 0 ? (
        <p className="text-foreground-weak text-sm">
          No automations yet. Click <em>New automation</em> to schedule an
          agent.
        </p>
      ) : (
        <AutomationTable automations={automations} workspaceSlug={slug} />
      )}
    </div>
  );
}

function AutomationTable({
  automations,
  workspaceSlug,
}: {
  automations: Automation[];
  workspaceSlug: string;
}) {
  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-surface-secondary text-foreground-weak text-xs uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-left font-medium">Agent</th>
            <th className="px-3 py-2 text-left font-medium">Schedule</th>
            <th className="px-3 py-2 text-left font-medium">Next fire</th>
            <th className="px-3 py-2 text-left font-medium">Last fire</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-weak)]">
          {automations.map((a) => (
            <AutomationRow
              key={a.id}
              automation={a}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AutomationRow({
  automation,
  workspaceSlug,
}: {
  automation: Automation;
  workspaceSlug: string;
}) {
  const preview = validateCron(automation.cron);
  const nextFire = automation.enabled
    ? nextFireAfter(automation.cron, new Date())
    : null;
  const agentHref = `/${workspaceSlug}/agents/${encodeURIComponent(automation.agentName)}`;
  const editHref = `/${workspaceSlug}/automations/${automation.id}`;
  return (
    <tr className="bg-surface-raised">
      <td className="px-3 py-2 align-top">
        <Link href={editHref} className="text-foreground font-medium hover:underline">
          {automation.name}
        </Link>
      </td>
      <td className="px-3 py-2 align-top">
        <Link href={agentHref} className="text-foreground hover:underline">
          {automation.agentName}
        </Link>
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col gap-0.5">
          <code className="text-foreground text-xs">{automation.cron}</code>
          {preview.ok && (
            <span className="text-foreground-weak text-xs">
              {preview.humanReadable}{" "}
              <span className="text-foreground-muted">(UTC)</span>
            </span>
          )}
        </div>
      </td>
      <td className="text-foreground-weak px-3 py-2 align-top text-xs">
        {nextFire ? (
          <LocalTime iso={nextFire.toISOString()} />
        ) : (
          <span className="text-foreground-muted">—</span>
        )}
      </td>
      <td className="text-foreground-weak px-3 py-2 align-top text-xs">
        {automation.lastFiredAt ? (
          <LocalTime iso={automation.lastFiredAt.toISOString()} />
        ) : (
          <span className="text-foreground-muted">Never</span>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <StatusBadge automation={automation} />
        {automation.lastFireError && (
          <p className="text-sentiment-negative mt-1 max-w-[220px] text-xs leading-4">
            {automation.lastFireError}
          </p>
        )}
      </td>
      <td className="px-3 py-2 align-top text-right">
        <div className="flex justify-end gap-2">
          <ToggleEnabledForm
            workspaceSlug={workspaceSlug}
            id={automation.id}
            enabled={automation.enabled}
          />
          <Link
            href={editHref}
            className="text-foreground-weak hover:text-foreground text-xs"
          >
            Edit
          </Link>
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ automation }: { automation: Automation }) {
  if (!automation.enabled) {
    return (
      <Badge variant="gray" size="small">
        Disabled
      </Badge>
    );
  }
  if (automation.lastFireError) {
    return (
      <Badge variant="red" size="small">
        Error
      </Badge>
    );
  }
  return (
    <Badge variant="green" size="small">
      Enabled
    </Badge>
  );
}
