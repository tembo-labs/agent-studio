import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { type AuditEntry, type AuditSource } from "@/lib/audit-db";

// Per-agent slice of the audit timeline (US-0.4-01 AC #3).
//
// Compact list — no filter UI here; the audit-page workspace view
// owns that. Cap at 20 entries so the agent detail page doesn't
// become a scroll trap, with a "View full history →" link to the
// workspace audit page prefiltered to this agent.

type Props = {
  workspaceSlug: string;
  agentName: string;
  entries: AuditEntry[];
};

export function AgentTimeline({ workspaceSlug, agentName, entries }: Props) {
  const auditHref = `/${workspaceSlug}/audit?agent=${encodeURIComponent(agentName)}`;
  const exportHref = `/api/workspaces/${workspaceSlug}/audit/export?agent=${encodeURIComponent(agentName)}&since=all`;
  return (
    <Section
      title="Timeline"
      description="Recent changes and runs for this agent. Same data, finer slice, of the workspace-wide audit log."
      actions={
        <div className="flex items-center gap-3 text-xs">
          <a
            href={exportHref}
            download
            className="text-foreground-weak hover:text-foreground"
          >
            Export JSON →
          </a>
          <Link
            href={auditHref}
            className="text-foreground-weak hover:text-foreground"
          >
            View full history →
          </Link>
        </div>
      }
    >
      {entries.length === 0 ? (
        <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
          No audit events yet. The first run, change, or trigger creates one.
        </p>
      ) : (
        <ul className="divide-border flex flex-col divide-y border-y border-[var(--color-border)]">
          {entries.map((e) => (
            <li
              key={`${e.origin}:${e.id}`}
              className="flex items-baseline justify-between gap-3 py-2 text-xs"
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <Badge variant={SOURCE_TONE[e.source]} size="small">
                  {SOURCE_LABELS[e.source]}
                </Badge>
                <span className="text-foreground truncate font-medium">
                  {humanKind(e.kind)}
                </span>
                <span className="text-foreground-weak truncate">
                  {summarize(e)}
                </span>
              </div>
              <span className="text-foreground-muted shrink-0">
                {e.actorDisplayName ?? "System"} ·{" "}
                <LocalTime iso={e.at.toISOString()} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function summarize(e: AuditEntry): string {
  const p = e.payload;
  switch (e.kind) {
    case "run.succeeded":
    case "run.failed":
    case "run.running":
    case "run.queued":
      return p.errorMessage
        ? String(p.errorMessage).slice(0, 80)
        : String(p.status ?? "");
    case "improvement.submitted":
    case "improvement.pr_opened":
    case "improvement.merged":
    case "improvement.closed":
      return String(p.improvementText ?? "");
    case "automation.created":
    case "automation.updated":
    case "automation.deleted":
    case "automation.enabled":
    case "automation.disabled":
      return String(p.name ?? "");
    case "trigger.created":
    case "trigger.deleted":
    case "trigger.enabled":
    case "trigger.disabled":
      return `${String(p.toolkit ?? "")} · ${String(p.triggerType ?? "")}`;
    default:
      return "";
  }
}

const SOURCE_LABELS: Record<AuditSource, string> = {
  chat: "Chat",
  pr: "PR",
  hitl_response: "HITL",
  dashboard_event: "Dashboard",
  correction: "Correction",
  human_action: "Human",
  policy_change: "Policy",
  system: "System",
};

const SOURCE_TONE: Record<
  AuditSource,
  "gray" | "blue" | "green" | "yellow" | "red" | "purple"
> = {
  chat: "blue",
  pr: "purple",
  hitl_response: "yellow",
  dashboard_event: "gray",
  correction: "red",
  human_action: "green",
  policy_change: "yellow",
  system: "gray",
};

function humanKind(kind: string): string {
  const map: Record<string, string> = {
    "run.queued": "Run queued",
    "run.running": "Run started",
    "run.succeeded": "Run succeeded",
    "run.failed": "Run failed",
    "improvement.submitted": "Improvement submitted",
    "improvement.pr_opened": "Improvement PR opened",
    "improvement.merged": "Improvement merged",
    "improvement.closed": "Improvement closed",
    "automation.created": "Automation created",
    "automation.updated": "Automation updated",
    "automation.deleted": "Automation deleted",
    "automation.enabled": "Automation enabled",
    "automation.disabled": "Automation disabled",
    "trigger.created": "Trigger created",
    "trigger.deleted": "Trigger deleted",
    "trigger.enabled": "Trigger enabled",
    "trigger.disabled": "Trigger disabled",
    "agent.deleted": "Agent deleted",
    "agent.restored": "Agent restored",
    "member.added": "Member added",
    "member.role_changed": "Member role changed",
    "member.removed": "Member removed",
    "audit.exported": "Audit exported",
  };
  return map[kind] ?? kind;
}
