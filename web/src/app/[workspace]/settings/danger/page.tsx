import { notFound } from "next/navigation";

import { Section } from "@/components/section";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, getWorkspaceRole } from "@/lib/workspace";

import { DeleteWorkspaceForm } from "../delete-workspace-form";

export const dynamic = "force-dynamic";

// Danger zone: destructive, irreversible workspace operations. Today
// that's "delete workspace" — gated to workspace_admin (the action
// re-checks). Lives at the end of the settings rail so an operator
// doesn't stumble into it.
export default async function DangerPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const role = await getWorkspaceRole(workspace.id, session.user.id);
  if (!role) notFound();
  const canDelete = role === "workspace_admin";

  return (
    <div className="divide-y divide-[var(--color-border-weak)]">
      <div className="pb-6 first:pt-0">
        <Section
          title="Delete workspace"
          description="Permanently delete this workspace and everything in it. This cannot be undone."
        >
          {canDelete ? (
            <div className="border-sentiment-negative/30 flex flex-col gap-3 rounded-lg border bg-[var(--color-input-error)] p-4">
              <p className="text-foreground-weak text-sm">
                Deletes all members, runs, schedules, connections, secrets, and
                settings for{" "}
                <span className="text-foreground font-medium">
                  {workspace.name}
                </span>
                . Your GitHub repository and its agent files are{" "}
                <span className="text-foreground font-medium">not</span>{" "}
                affected.
              </p>
              <DeleteWorkspaceForm
                workspaceSlug={workspace.slug}
                workspaceName={workspace.name}
              />
            </div>
          ) : (
            <p className="text-foreground-weak text-sm">
              Only workspace admins can delete this workspace.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
