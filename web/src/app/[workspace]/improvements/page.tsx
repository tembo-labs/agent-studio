import { notFound } from "next/navigation";
import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { improvementSubmitterLabel } from "@/lib/improvement-display";
import { scanImprovementsForPRs } from "@/lib/improvement-scan";
import {
  listImprovements,
  listOpenImprovements,
  type Improvement,
  type ImprovementStatus,
} from "@/lib/improvements-api";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ImprovementsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  // Scan open rows for PR updates before reading the full list. The
  // scan writes back to postgres, so the subsequent listImprovements
  // returns fresh status values without us having to merge two
  // arrays.
  const open = await listOpenImprovements(workspace.id);
  await scanImprovementsForPRs(workspace.id, open);
  const improvements = await listImprovements(workspace.id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Improvements
        </h1>
        <p className="text-foreground-weak text-base">
          Each row is an improvement submission from a run&apos;s
          &ldquo;Improve the Agent&rdquo; form. Status updates when a Tembo
          task opens a PR and when that PR is merged.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {improvements.length === 0 ? (
        <p className="text-foreground-weak text-base">
          No improvements yet. Open a run, scroll to{" "}
          <em>Improve the Agent</em>, and submit one to start.
        </p>
      ) : (
        <ImprovementTable
          improvements={improvements}
          workspaceSlug={workspace.slug}
        />
      )}
    </div>
  );
}

function ImprovementTable({
  improvements,
  workspaceSlug,
}: {
  improvements: Improvement[];
  workspaceSlug: string;
}) {
  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-surface-secondary text-foreground-weak text-sm uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Agent</th>
            <th className="px-3 py-2 text-left font-medium">Improvement</th>
            <th className="px-3 py-2 text-left font-medium">By</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-left font-medium">Submitted</th>
            <th className="px-3 py-2 text-left font-medium">Links</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-weak)]">
          {improvements.map((i) => (
            <ImprovementRow
              key={i.id}
              improvement={i}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImprovementRow({
  improvement,
  workspaceSlug,
}: {
  improvement: Improvement;
  workspaceSlug: string;
}) {
  const agentHref = `/${workspaceSlug}/agents/${encodeURIComponent(improvement.agentName)}`;
  const runHref = `${agentHref}/runs/${improvement.runId}`;
  return (
    <tr className="bg-surface-raised">
      <td className="px-3 py-2 align-top">
        <Link
          href={agentHref}
          className="text-foreground font-medium hover:underline"
        >
          {improvement.agentName}
        </Link>
      </td>
      <td className="text-foreground max-w-md px-3 py-2 align-top">
        <span className="line-clamp-2 leading-5">
          {improvement.improvementText}
        </span>
      </td>
      <td className="text-foreground px-3 py-2 align-top text-xs">
        {improvementSubmitterLabel(improvement)}
      </td>
      <td className="px-3 py-2 align-top">
        <StatusBadge status={improvement.status} />
      </td>
      <td className="text-foreground-weak px-3 py-2 align-top text-xs">
        <LocalTime iso={improvement.createdAt.toISOString()} />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href={runHref} className="text-foreground hover:underline">
            Run
          </Link>
          {improvement.temboTaskHtmlUrl && (
            <a
              href={improvement.temboTaskHtmlUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground hover:underline"
            >
              Tembo Session ↗
            </a>
          )}
          {improvement.prUrl && (
            <a
              href={improvement.prUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground hover:underline"
            >
              PR #{improvement.prNumber} ↗
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: ImprovementStatus }) {
  switch (status) {
    case "submitted":
      return (
        <Badge variant="gray" size="small">
          Submitted
        </Badge>
      );
    case "pr_opened":
      return (
        <Badge variant="blue" size="small">
          PR opened
        </Badge>
      );
    case "merged":
      return (
        <Badge variant="green" size="small">
          Merged
        </Badge>
      );
    case "closed":
      return (
        <Badge variant="red" size="small">
          Closed
        </Badge>
      );
  }
}
