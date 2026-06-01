import Link from "next/link";
import { notFound } from "next/navigation";

import {
  listAllToolkits,
  type CatalogToolkit,
  type ComposioToolkit,
} from "@/lib/composio";
import { listConnectionsForUser } from "@/lib/composio-connections";
import { listToolsForUser, type McpTool } from "@/lib/mcp-tools";
import { getServerSession } from "@/lib/session";
import { listAgents } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceSecretPlaintext,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { ComposioConnectionsSection } from "../../settings/composio-connections-section";

export const dynamic = "force-dynamic";

// Composio half of the Connections page. The substrate is Composio's
// hosted OAuth + Tool Router; an agent's `connections:` entry with
// the default `source: composio` resolves through whatever the user
// has authorized here.

export default async function ComposioConnectionsPage({
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

  const [composioPreview, myConnections, agentsListing, allTools] =
    await Promise.all([
      getWorkspaceSecretPreview(workspace.id, "composio_api_key"),
      listConnectionsForUser(workspace.id, session.user.id),
      listAgents(workspace.id),
      listToolsForUser(workspace.id, session.user.id),
    ]);

  // Tool buckets keyed by `${source}:${provider}:${name}` so each
  // row can render its own count + expand without scanning the
  // full set in JS per render.
  const toolsBySlot = new Map<string, McpTool[]>();
  for (const t of allTools) {
    const key = `${t.source}:${t.provider}:${t.connectionName}`;
    const arr = toolsBySlot.get(key);
    if (arr) arr.push(t);
    else toolsBySlot.set(key, [t]);
  }

  // Toolkit catalog feeds the "Add another" picker. Only fetched
  // when the workspace has a Composio key — otherwise we'd burn a
  // useless round trip on an empty form.
  const catalog: CatalogToolkit[] = composioPreview
    ? await getWorkspaceSecretPlaintext(workspace.id, "composio_api_key")
        .then((apiKey) => listAllToolkits(apiKey))
        .catch((e) => {
          console.error("[connections] listAllToolkits failed:", e);
          return [];
        })
    : [];

  // Slots declared by any pydantic-agentspec agent in the repo,
  // filtered to source=composio so native-MCP entries don't
  // masquerade as missing Composio toolkits here.
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

  // Composio OAuth callback bounces back here with
  // ?composio=…&result=…&detail=… — render the banner inside the
  // ComposioConnectionsSection so it lands next to the row that
  // just got authorized.
  const resultParam = typeof sp.result === "string" ? sp.result : undefined;
  const detailParam = typeof sp.detail === "string" ? sp.detail : undefined;
  const composioParam =
    typeof sp.composio === "string" ? sp.composio : undefined;
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

  return (
    <>
      {!composioPreview && (
        <div className="border-border bg-surface rounded-lg border px-3 py-2 text-sm">
          <span className="text-foreground-weak">
            Composio connections require a workspace-level Composio API
            key.{" "}
            <Link
              href={`/${workspace.slug}/settings/composio`}
              className="text-foreground underline underline-offset-2"
            >
              Set it in Settings →
            </Link>
          </span>
        </div>
      )}

      <ComposioConnectionsSection
        workspaceSlug={workspace.slug}
        connections={myConnections}
        declaredSlots={declaredSlots}
        catalog={catalog}
        composioEnabled={Boolean(composioPreview)}
        banner={composioBanner}
        toolsBySlot={toolsBySlot}
      />
    </>
  );
}
