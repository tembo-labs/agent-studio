import Link from "next/link";
import { notFound } from "next/navigation";

import { listToolsForUser } from "@/lib/mcp-tools";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { ToolsTable } from "./tools-table";

export const dynamic = "force-dynamic";

// Tools tab — unified, searchable view of every cached MCP tool the
// current user has across all connections (composio + native).
// Caches are populated on connect and refreshed from the Connections
// page; this page never contacts upstream itself.
//
// Per-user: connections are per-user, so another member's
// authorizations don't show up here. The actual filter/search logic
// lives in tools-table.tsx (client component) — this page just
// loads the data and renders the shell.

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const tools = await listToolsForUser(workspace.id, session.user.id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Tools
        </h1>
        <p className="text-foreground-weak text-sm">
          Every MCP tool you&apos;ve authorized in{" "}
          <span className="text-foreground font-medium">{workspace.name}</span>,
          across Composio and native MCP providers. Tools are cached on
          connect; refresh a connection from{" "}
          <Link
            href={`/${workspace.slug}/connections`}
            className="text-foreground underline underline-offset-2"
          >
            Connections
          </Link>{" "}
          to pick up provider-side changes.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <ToolsTable workspaceSlug={workspace.slug} tools={tools} />
    </div>
  );
}
