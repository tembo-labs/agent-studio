import { notFound } from "next/navigation";

import { listApiKeys } from "@/lib/api-keys-db";
import { getPublicOrigin } from "@/lib/config";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { ApiKeysSection } from "./api-keys-section";

export const dynamic = "force-dynamic";

// Personal API keys: the credential for the public REST API (/api/v1) and the
// MCP server (/mcp). Each key acts as the member who created it, so it inherits
// their live workspace role and uses their per-user connections. We show the
// caller their OWN keys only (a personal-access-token model).

export default async function ApiKeysSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const session = await getServerSession();
  if (!session) notFound();
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const all = await listApiKeys(workspace.id);
  const mine = all
    .filter((k) => k.userId === session.user.id)
    .map((k) => ({
      id: k.id,
      name: k.name,
      tokenLast4: k.tokenLast4,
      enabled: k.enabled,
      lastUsedAtIso: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
      createdAtIso: k.createdAt.toISOString(),
    }));

  return (
    <ApiKeysSection
      workspaceSlug={workspace.slug}
      origin={getPublicOrigin()}
      keys={mine}
    />
  );
}
