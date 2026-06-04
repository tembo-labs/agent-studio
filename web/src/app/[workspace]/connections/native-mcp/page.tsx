import { notFound } from "next/navigation";

import {
  listNativeConnectionsForUser,
  type WorkspaceConnection,
} from "@/lib/connections";
import { resolveConnectionsView } from "@/lib/connections-view";
import { listMcpProviders } from "@/lib/mcp-providers";
import { listToolsForUser, type McpTool } from "@/lib/mcp-tools";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { NativeMcpConnectionsSection } from "../native-mcp-connections-section";

export const dynamic = "force-dynamic";

// Native MCP half of the Connections page. TAS-managed OAuth +
// direct connection to each provider's official MCP server. Agent
// `connections:` entries with `source: native-mcp` resolve through
// whatever the user has authorized here.

export default async function NativeMcpConnectionsPage({
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

  const [nativeConnections, allTools] = await Promise.all([
    listNativeConnectionsForUser(workspace.id, view.userId),
    listToolsForUser(workspace.id, view.userId),
  ]);

  // Same bucketing as the composio sub-page — the tools query
  // returns everything for the user; we slice by source +
  // provider + connection_name into the rows we'll render.
  const toolsBySlot = new Map<string, McpTool[]>();
  for (const t of allTools) {
    if (t.source !== "native-mcp") continue;
    const key = `${t.provider}:${t.connectionName}`;
    const arr = toolsBySlot.get(key);
    if (arr) arr.push(t);
    else toolsBySlot.set(key, [t]);
  }

  // One row per (provider, name) slot the user has authorized.
  // Catalog providers with zero connections still get a single
  // "first-time Connect" placeholder row so the user can discover
  // them without going through the Add Another form.
  const nativeCatalog = listMcpProviders();
  const activeByProvider = new Map<string, WorkspaceConnection[]>();
  for (const c of nativeConnections.filter((c) => c.status === "active")) {
    const arr = activeByProvider.get(c.type) ?? [];
    arr.push(c);
    activeByProvider.set(c.type, arr);
  }
  type NativeRow = {
    provider: (typeof nativeCatalog)[number];
    connection: WorkspaceConnection | null;
    tools: McpTool[];
  };
  const nativeProviderRows: NativeRow[] = [];
  for (const provider of nativeCatalog) {
    const conns = activeByProvider.get(provider.slug) ?? [];
    if (conns.length === 0) {
      nativeProviderRows.push({ provider, connection: null, tools: [] });
      continue;
    }
    conns.sort((a, b) => {
      if (a.name === "default") return -1;
      if (b.name === "default") return 1;
      return a.name.localeCompare(b.name);
    });
    for (const c of conns) {
      nativeProviderRows.push({
        provider,
        connection: c,
        tools: toolsBySlot.get(`${provider.slug}:${c.name}`) ?? [],
      });
    }
  }

  // Native MCP OAuth callback bounces back here with
  // ?native_mcp=…&result=…&detail=… — render the banner inside
  // the section so it lands next to the row that just connected.
  const resultParam = typeof sp.result === "string" ? sp.result : undefined;
  const detailParam = typeof sp.detail === "string" ? sp.detail : undefined;
  const nativeMcpParam =
    typeof sp.native_mcp === "string" ? sp.native_mcp : undefined;
  const banner =
    nativeMcpParam &&
    /^[a-z0-9_-]+$/.test(nativeMcpParam) &&
    (resultParam === "ok" || resultParam === "error")
      ? {
          provider: nativeMcpParam,
          result: resultParam as "ok" | "error",
          detail: detailParam,
        }
      : undefined;

  return (
    <>
      {view.viewingOther && view.viewedMember && (
        <div className="border-border bg-surface-secondary rounded-lg border px-3 py-2 text-sm">
          <span className="text-foreground-weak">
            Viewing{" "}
            <span className="text-foreground font-medium">
              {view.viewedMember.name ?? view.viewedMember.email}
            </span>
            &apos;s connections. You can rename and refresh them; connecting
            and disconnecting must be done by that member.
          </span>
        </div>
      )}
      <NativeMcpConnectionsSection
        workspaceSlug={workspace.slug}
        providers={nativeProviderRows}
        catalog={nativeCatalog}
        banner={banner}
        viewingOther={view.viewingOther}
      />
    </>
  );
}
