import { notFound } from "next/navigation";

import { listSecretConnections } from "@/lib/secret-connections";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, getWorkspaceRole } from "@/lib/workspace";

import { SecretsSection } from "../secrets-section";

export const dynamic = "force-dynamic";

// Secrets half of the Connections page — the 3rd substrate. Free-form,
// workspace-level API keys an admin sets; sidecar Python tools read them
// via tas_tools.secret("<slug>"). Workspace-wide, so (unlike the OAuth
// substrates) there's no per-user "viewing as" — everyone sees the same set,
// only admins can change it.

export default async function SecretsConnectionsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const [secrets, role] = await Promise.all([
    listSecretConnections(workspace.id),
    getWorkspaceRole(workspace.id, session.user.id),
  ]);

  return (
    <SecretsSection
      workspaceSlug={workspace.slug}
      secrets={secrets}
      canManage={role === "workspace_admin"}
    />
  );
}
