import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import type { AgentVersion } from "@/lib/agent-versions";

// The agent's released versions, newest first. Each links to a per-version
// view (frozen spec + diff vs previous). The current stable version is
// badged "Current".

export function VersionsSection({
  versions,
  stableVersionId,
  workspaceSlug,
  agentName,
  nameFor,
}: {
  versions: AgentVersion[];
  stableVersionId: string | null;
  workspaceSlug: string;
  agentName: string;
  nameFor: (userId: string) => string;
}) {
  if (versions.length === 0) {
    return (
      <Section
        title="Versions"
        description="Promote the draft to capture a numbered, stable version that runs use by default."
      >
        <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
          No stable versions yet. Runs use the live draft until you promote one.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Versions"
      description="Each promotion freezes the draft as a numbered version. Runs default to the current stable version."
    >
      <ul className="divide-border flex flex-col divide-y border-y border-[var(--color-border)]">
        {versions.map((v) => (
          <li key={v.id} className="flex items-start justify-between gap-3 py-2.5">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <Link
                  href={`/${workspaceSlug}/agents/${encodeURIComponent(agentName)}/versions/${v.versionNumber}`}
                  className="text-foreground font-medium hover:underline"
                >
                  v{v.versionNumber}
                </Link>
                {v.id === stableVersionId && (
                  <Badge variant="green" size="small">
                    Current
                  </Badge>
                )}
                <span className="text-foreground-muted text-sm">
                  {nameFor(v.createdBy)} ·{" "}
                  <LocalTime
                    iso={v.createdAt.toISOString()}
                    style="relative"
                  />
                </span>
              </div>
              {v.changeSummary && (
                <p className="text-foreground-weak line-clamp-2 max-w-prose text-sm">
                  {v.changeSummary}
                </p>
              )}
            </div>
            <Link
              href={`/${workspaceSlug}/agents/${encodeURIComponent(agentName)}/versions/${v.versionNumber}`}
              className="text-foreground-weak hover:text-foreground shrink-0 text-sm"
            >
              View →
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
