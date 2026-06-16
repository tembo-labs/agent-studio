import Link from "next/link";
import { notFound } from "next/navigation";

import { IconPlusLarge } from "central-icons";

import { McpProviderLogo } from "@/components/mcp-provider-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveConnectionsView } from "@/lib/connections-view";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, listWorkspaceMembers } from "@/lib/workspace";

import { listAllConnections, type ConnectionRow } from "./connection-ref";
import { ViewAsSelect } from "./view-as-select";

export const dynamic = "force-dynamic";

// Connections list — every connection the (view-)user has, across native-MCP +
// Composio OAuth and workspace secrets, as clickable rows like /agents. Admin
// substrate config (enable providers, BYO OAuth apps) lives on /providers.
export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace: slug } = await params;
  const sp = await searchParams;

  const session = await getServerSession();
  if (!session) notFound();
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const requestedUser = typeof sp.user === "string" ? sp.user : undefined;
  const view = await resolveConnectionsView(
    workspace.id,
    session.user.id,
    requestedUser,
  );
  const members = view.isAdmin ? await listWorkspaceMembers(workspace.id) : [];
  const rows = await listAllConnections(workspace.id, view.userId);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
            Connections
          </h1>
          <p className="text-foreground-weak text-base">
            Authorizations and secrets the agents in{" "}
            <span className="text-foreground font-medium">{workspace.name}</span>{" "}
            use at run time. OAuth connections are per-user; secrets are shared
            across the workspace.
          </p>
        </div>
        {view.isAdmin && members.length > 1 && (
          <ViewAsSelect
            members={members.map((m) => ({
              userId: m.userId,
              name: m.name,
              email: m.email,
            }))}
            currentUserId={session.user.id}
          />
        )}
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {typeof sp.result === "string" && sp.result === "error" && (
        <div className="border-sentiment-negative rounded-lg border bg-[var(--color-input-error)] px-3 py-2 text-sm">
          <span className="text-foreground">
            Connection failed
            {typeof sp.detail === "string" ? `: ${sp.detail}` : "."}
          </span>
        </div>
      )}

      {view.viewingOther && view.viewedMember && (
        <div className="border-border bg-surface-secondary rounded-lg border px-3 py-2 text-sm">
          <span className="text-foreground-weak">
            Viewing{" "}
            <span className="text-foreground font-medium">
              {view.viewedMember.name ?? view.viewedMember.email}
            </span>
            &apos;s connections. You can rename and refresh them; connecting and
            disconnecting must be done by that member.
          </span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {view.isAdmin && (
          <Button asChild variant="secondary">
            <Link href={`/${workspace.slug}/connections/providers`}>
              Manage providers
            </Link>
          </Button>
        )}
        {!view.viewingOther && (
          <Button asChild>
            <Link href={`/${workspace.slug}/connections/new`}>
              <IconPlusLarge size={16} />
              <span>New connection</span>
            </Link>
          </Button>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <ConnectionRowLink
              key={row.ref}
              row={row}
              workspaceSlug={workspace.slug}
              viewUserId={view.viewingOther ? view.userId : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="text-foreground-muted rounded-lg border border-dashed border-[var(--color-border)] px-3 py-10 text-center text-sm">
          No connections yet. Connect a provider or add a secret to give agents
          something to use.
        </p>
      )}
    </div>
  );
}

function ConnectionRowLink({
  row,
  workspaceSlug,
  viewUserId,
}: {
  row: ConnectionRow;
  workspaceSlug: string;
  viewUserId?: string;
}) {
  // Carry the viewed-member through so an admin keeps the same view on the
  // detail page.
  const href = `/${workspaceSlug}/connections/${row.ref}${
    viewUserId ? `?user=${encodeURIComponent(viewUserId)}` : ""
  }`;
  return (
    <Link
      href={href}
      className="border-border bg-surface hover:bg-surface-secondary group flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {row.logoSlug ? (
          <McpProviderLogo slug={row.logoSlug} label={row.title} size={20} />
        ) : (
          <span
            className="bg-surface-secondary text-foreground-muted inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs"
            aria-hidden
          >
            ⚿
          </span>
        )}
        <span className="text-foreground group-hover:underline font-medium">
          {row.title}
        </span>
        {row.slot && (
          <span className="text-foreground-muted truncate text-sm">
            · {row.slot}
          </span>
        )}
        <span className="text-foreground-muted text-xs uppercase tracking-wide">
          {row.typeLabel}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Badge variant={row.statusVariant} size="small">
          {row.statusLabel}
        </Badge>
        <span className="text-foreground-muted text-sm" aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}
