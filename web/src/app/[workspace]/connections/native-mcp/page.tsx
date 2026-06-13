import { notFound } from "next/navigation";

import {
  listNativeConnectionsForUser,
  type WorkspaceConnection,
} from "@/lib/connections";
import { resolveConnectionsView } from "@/lib/connections-view";
import { listMcpProviders } from "@/lib/mcp-providers";
import { listToolsForUser, type McpTool } from "@/lib/mcp-tools";
import {
  getProviderEnableMap,
  isProviderAdminEnabled,
} from "@/lib/native-mcp-providers-admin";
import { listNativeOAuthClients } from "@/lib/native-oauth-clients";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import {
  NativeMcpConnectionsSection,
  type ManualConnectTarget,
} from "../native-mcp-connections-section";

export const dynamic = "force-dynamic";

// Native MCP half of the Connections page. TAS-managed OAuth + direct
// connection to each provider's official MCP server. Agent `connections:`
// entries with `source: native-mcp` resolve through whatever the user has
// authorized here. Admin setup (enable providers + register OAuth apps) lives
// on the separate /native-mcp/admin screen.

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

  const [nativeConnections, allTools, oauthClients, enableMap] =
    await Promise.all([
      listNativeConnectionsForUser(workspace.id, view.userId),
      listToolsForUser(workspace.id, view.userId),
      listNativeOAuthClients(workspace.id),
      getProviderEnableMap(workspace.id),
    ]);

  // Slice the user's tools by source + provider + connection_name into rows.
  const toolsBySlot = new Map<string, McpTool[]>();
  for (const t of allTools) {
    if (t.source !== "native-mcp") continue;
    const key = `${t.provider}:${t.connectionName}`;
    const arr = toolsBySlot.get(key);
    if (arr) arr.push(t);
    else toolsBySlot.set(key, [t]);
  }

  const nativeCatalog = listMcpProviders();

  // Which OAuth app instances exist per manual provider.
  const instancesByProvider = new Map<
    string,
    { instance: string; label: string | null }[]
  >();
  for (const c of oauthClients) {
    const arr = instancesByProvider.get(c.provider) ?? [];
    arr.push({ instance: c.instance, label: c.label });
    instancesByProvider.set(c.provider, arr);
  }

  // A provider is visible to members when the admin enabled it; manual
  // providers additionally need at least one configured OAuth app instance.
  const isVisible = (provider: (typeof nativeCatalog)[number]): boolean => {
    if (!isProviderAdminEnabled(provider, enableMap)) return false;
    if (provider.authMode === "manual") {
      return (instancesByProvider.get(provider.slug)?.length ?? 0) > 0;
    }
    return true;
  };

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
    const isManual = provider.authMode === "manual";
    const conns = activeByProvider.get(provider.slug) ?? [];
    conns.sort((a, b) => {
      if (a.name === "default") return -1;
      if (b.name === "default") return 1;
      return a.name.localeCompare(b.name);
    });
    // Always show connected rows (even if the provider was later disabled, so
    // the user can still see/disconnect them).
    for (const c of conns) {
      nativeProviderRows.push({
        provider,
        connection: c,
        tools: toolsBySlot.get(`${provider.slug}:${c.name}`) ?? [],
      });
    }
    // DCR providers get a first-time Connect placeholder; manual providers
    // connect via the instance form (manualConnect) instead.
    if (!isManual && conns.length === 0 && isVisible(provider)) {
      nativeProviderRows.push({ provider, connection: null, tools: [] });
    }
  }

  // Visible DCR providers feed the "Add another" named-slot picker. Self-key
  // (Tembo) is excluded — it's a single per-user "default" slot, not a
  // multi-account provider, and agent specs reference it as `{type: tembo}`.
  const addableProviders = nativeCatalog.filter(
    (p) =>
      p.authMode !== "manual" && p.authMode !== "self-key" && isVisible(p),
  );
  // Visible manual providers + their connectable instances.
  const manualConnect: ManualConnectTarget[] = nativeCatalog
    .filter((p) => p.authMode === "manual" && isVisible(p))
    .map((p) => ({
      provider: p,
      instances: instancesByProvider.get(p.slug) ?? [],
    }));

  // Native MCP OAuth callback bounces back here with
  // ?native_mcp=…&result=…&detail=… — render the banner inside the section.
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
        addableProviders={addableProviders}
        manualConnect={view.viewingOther ? [] : manualConnect}
        banner={banner}
        viewingOther={view.viewingOther}
      />
    </>
  );
}
