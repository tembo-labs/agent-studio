import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { toolkitLabel } from "@/lib/composio-label";
import { resolveConnectionsView } from "@/lib/connections-view";
import { getMcpProvider } from "@/lib/mcp-providers";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { loadConnection, parseConnectionRef } from "../../connection-ref";
import { RenameComposioConnectionForm } from "../../../settings/rename-composio-connection-form";
import { RenameNativeMcpConnectionForm } from "../../rename-native-mcp-connection-form";
import { SecretEditForm } from "./secret-edit-form";

export const dynamic = "force-dynamic";

export default async function EditConnectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace: slug, id } = await params;
  const sp = await searchParams;

  const session = await getServerSession();
  if (!session) notFound();
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const ref = parseConnectionRef(id);
  if (!ref) notFound();

  const requestedUser = typeof sp.user === "string" ? sp.user : undefined;
  const view = await resolveConnectionsView(
    workspace.id,
    session.user.id,
    requestedUser,
  );
  // Editing acts on the connection; an admin viewing another member can rename
  // (the rename action allows it), but secrets edit is admin-only via the action.
  const loaded = await loadConnection(workspace.id, view.userId, ref);
  if (!loaded) notFound();

  const userQs = view.viewingOther
    ? `?user=${encodeURIComponent(view.userId)}`
    : "";
  const backHref = `/${workspace.slug}/connections/${id}${userQs}`;

  const title =
    loaded.kind === "secret"
      ? loaded.secret.slug
      : loaded.kind === "native"
        ? (getMcpProvider(loaded.conn.type)?.displayName ?? loaded.conn.type)
        : toolkitLabel(loaded.conn.toolkit);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <BackLink href={backHref} label={title} />
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Edit {title}
        </h1>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {loaded.kind === "secret" ? (
        <SecretEditForm
          workspaceSlug={workspace.slug}
          slug={loaded.secret.slug}
          description={loaded.secret.description}
        />
      ) : loaded.kind === "composio" ? (
        <Section title="Connection name">
          <RenameComposioConnectionForm
            workspaceSlug={workspace.slug}
            connectionId={loaded.conn.id}
            currentName={loaded.conn.name}
          />
        </Section>
      ) : getMcpProvider(loaded.conn.type)?.authMode === "dcr" ? (
        <Section title="Connection name">
          <RenameNativeMcpConnectionForm
            workspaceSlug={workspace.slug}
            connectionId={loaded.conn.id}
            currentName={loaded.conn.name}
          />
        </Section>
      ) : (
        <p className="text-foreground-weak text-sm">
          This connection can&apos;t be renamed — its name is fixed by the
          provider. To remove it, use Disconnect on the connection page.
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-foreground text-sm font-medium">{title}</span>
      {children}
    </div>
  );
}
