import Link from "next/link";
import { notFound } from "next/navigation";

import {
  listAllToolkits,
  type CatalogToolkit,
  type ComposioToolkit,
} from "@/lib/composio";
import { listConnectionsForUser } from "@/lib/composio-connections";
import {
  listNativeConnectionsForUser,
  type WorkspaceConnection,
} from "@/lib/connections";
import { listMcpProviders } from "@/lib/mcp-providers";
import { listToolsForUser, type McpTool } from "@/lib/mcp-tools";
import { getServerSession } from "@/lib/session";
import { listAgents } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceRole,
  getWorkspaceSecretPlaintext,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { ComposioConnectionsSection } from "../settings/composio-connections-section";
import { NativeMcpConnectionsSection } from "./native-mcp-connections-section";

export const dynamic = "force-dynamic";

// Per-user OAuth authorizations live here, separate from Settings —
// Settings is for workspace-level config (API keys, theme, repo);
// Connections is a personal action surface that each member touches
// every time an agent declares a new toolkit.
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

  const [
    composioPreview,
    myConnections,
    agentsListing,
    nativeConnections,
    currentUserRole,
    allTools,
  ] = await Promise.all([
    getWorkspaceSecretPreview(workspace.id, "composio_api_key"),
    listConnectionsForUser(workspace.id, session.user.id),
    listAgents(workspace.id),
    listNativeConnectionsForUser(workspace.id, session.user.id),
    getWorkspaceRole(workspace.id, session.user.id),
    listToolsForUser(workspace.id, session.user.id),
  ]);
  if (!currentUserRole) notFound();

  // Bucket tools by `${source}:${provider}:${name}` once so each row
  // can render its own count + expand without scanning the full set
  // in JS for every row. The list is per-user and bounded (~hundreds
  // of tools across all connections), so an in-memory group is fine.
  const toolsBySlot = new Map<string, McpTool[]>();
  for (const t of allTools) {
    const key = `${t.source}:${t.provider}:${t.connectionName}`;
    const arr = toolsBySlot.get(key);
    if (arr) arr.push(t);
    else toolsBySlot.set(key, [t]);
  }

  // One row per (provider, name) slot the user has authorized.
  // Catalog providers with zero connections still get a single
  // "first-time Connect" placeholder row so the user can discover
  // them without going through the Add Another form. Providers with
  // ≥1 connection get one row per slot — mirrors how a user with
  // multiple Composio Gmail accounts sees multiple rows.
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
    // Stable order: "default" first, then alphabetical, so a user's
    // primary slot leads the list.
    conns.sort((a, b) => {
      if (a.name === "default") return -1;
      if (b.name === "default") return 1;
      return a.name.localeCompare(b.name);
    });
    for (const c of conns) {
      nativeProviderRows.push({
        provider,
        connection: c,
        tools:
          toolsBySlot.get(`native-mcp:${provider.slug}:${c.name}`) ?? [],
      });
    }
  }

  // Composio catalog feeds the toolkit picker on the "Add another"
  // form. Only fetched when the workspace has an API key on file —
  // otherwise we'd hit Composio with nothing to authenticate and
  // burn a useless round trip. The lib helper caches in-process for
  // 5min, so this is a single call across all Connections renders.
  const catalog: CatalogToolkit[] = composioPreview
    ? await getWorkspaceSecretPlaintext(workspace.id, "composio_api_key")
        .then((apiKey) => listAllToolkits(apiKey))
        .catch((e) => {
          console.error("[connections] listAllToolkits failed:", e);
          return [];
        })
    : [];

  // Same shape ComposioConnectionsSection expects — pairs declared by
  // any pydantic-agentspec agent in the connected repo. Skip
  // native-MCP entries: those are surfaced by the NativeMcp section
  // and would otherwise look like missing Composio toolkits here.
  const declaredSlots: { toolkit: string; name: string }[] = (() => {
    if (!agentsListing.ok) return [];
    const seen = new Set<string>();
    const out: { toolkit: string; name: string }[] = [];
    for (const a of agentsListing.agents) {
      if (!a.ok) continue;
      if (a.spec.framework !== "pydantic-agentspec") continue;
      for (const conn of a.spec.connections) {
        if (conn.source !== "composio") continue;
        const toolkit = conn.toolkit.trim().toLowerCase();
        const name = conn.name.trim().toLowerCase() || "default";
        if (!toolkit) continue;
        const key = `${toolkit}:${name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ toolkit, name });
      }
    }
    return out;
  })();

  // OAuth callback bounces back to /connections (post-promotion) with
  // ?composio=…&result=…&detail=… (composio path) OR
  // ?native_mcp=…&result=…&detail=… (native-MCP path). Each banner
  // renders inside its own section.
  const resultParam = typeof sp.result === "string" ? sp.result : undefined;
  const detailParam = typeof sp.detail === "string" ? sp.detail : undefined;

  const composioParam = typeof sp.composio === "string" ? sp.composio : undefined;
  const composioBanner =
    composioParam &&
    /^[a-z0-9_-]+$/.test(composioParam) &&
    (resultParam === "ok" || resultParam === "error")
      ? {
          toolkit: composioParam as ComposioToolkit,
          result: resultParam as "ok" | "error",
          detail: detailParam,
        }
      : undefined;

  const nativeMcpParam =
    typeof sp.native_mcp === "string" ? sp.native_mcp : undefined;
  const nativeMcpBanner =
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Connections
        </h1>
        <p className="text-foreground-weak text-sm">
          OAuth authorizations the agents in{" "}
          <span className="text-foreground font-medium">{workspace.name}</span>{" "}
          can use at run time. Per-user — your authorizations don&apos;t
          show up for other workspace members.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {!composioPreview && (
        <div className="border-border bg-surface rounded-lg border px-3 py-2 text-sm">
          <span className="text-foreground-weak">
            Connections require a workspace-level Composio API key.{" "}
            <Link
              href={`/${workspace.slug}/settings`}
              className="text-foreground underline underline-offset-2"
            >
              Set it in Settings →
            </Link>
          </span>
        </div>
      )}

      <NativeMcpConnectionsSection
        workspaceSlug={workspace.slug}
        providers={nativeProviderRows}
        catalog={nativeCatalog}
        banner={nativeMcpBanner}
      />

      <ComposioConnectionsSection
        workspaceSlug={workspace.slug}
        connections={myConnections}
        declaredSlots={declaredSlots}
        catalog={catalog}
        composioEnabled={Boolean(composioPreview)}
        banner={composioBanner}
        toolsBySlot={toolsBySlot}
      />
    </div>
  );
}
