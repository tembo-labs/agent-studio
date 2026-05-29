import { notFound } from "next/navigation";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { listDeletedAgents } from "@/lib/workspace-agents";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { RestoreAgentForm } from "../restore-agent-form";

export const dynamic = "force-dynamic";

// Deleted agents stay around so the workspace has an undo path
// for an accidental delete. Restoring writes the file back to the
// connected repo with a new commit; the deletion event is
// preserved in audit either way.

export default async function DeletedAgentsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const deletedAgents = await listDeletedAgents(workspace.id);

  return (
    <Section
      title="Deleted agents"
      description="Agents removed from this workspace stay listed here so you can restore them. Restore writes the file back to the connected repo with a new commit; the deletion record is preserved for audit."
    >
      {deletedAgents.length === 0 ? (
        <p className="text-foreground-weak text-base">No deleted agents.</p>
      ) : (
        <ul className="divide-border flex flex-col divide-y border-y border-[var(--color-border)]">
          {deletedAgents.map((d) => (
            <li
              key={d.id}
              className="flex items-start justify-between gap-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-foreground text-sm font-medium">
                  {d.agentName}
                </span>
                <span className="text-foreground-muted text-sm">
                  <code>{d.filePath}</code>
                  <span>
                    {" · deleted "}
                    <LocalTime iso={d.deletedAt.toISOString()} />
                  </span>
                </span>
              </div>
              <RestoreAgentForm
                workspaceSlug={workspace.slug}
                deletionId={d.id}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
