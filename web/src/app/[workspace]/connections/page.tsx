import Link from "next/link";
import { notFound } from "next/navigation";

import {
  listAllToolkits,
  type CatalogToolkit,
  type ComposioToolkit,
} from "@/lib/composio";
import { listConnectionsForUser } from "@/lib/composio-connections";
import { getServerSession } from "@/lib/session";
import { listAgents } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceSecretPlaintext,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { ComposioConnectionsSection } from "../settings/composio-connections-section";

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

  const [composioPreview, myConnections, agentsListing] = await Promise.all([
    getWorkspaceSecretPreview(workspace.id, "composio_api_key"),
    listConnectionsForUser(workspace.id, session.user.id),
    listAgents(workspace.id),
  ]);

  // Composio catalog feeds the toolkit picker on the "Add another"
  // form. Only fetched when the workspace has an API key on file —
  // otherwise we'd hit Composio with nothing to authenticate and
  // burn a useless round trip. The lib helper caches in-process for
  // 5min, so this is a single call across all Connections renders.
  const catalog: CatalogToolkit[] = composioPreview
    ? await getWorkspaceSecretPlaintext(workspace.id, "composio_api_key")
        .then((apiKey) => listAllToolkits(apiKey))
        .catch(() => [])
    : [];

  // Same shape ComposioConnectionsSection expects — pairs declared by
  // any pydantic-agentspec agent in the connected repo.
  const declaredSlots: { toolkit: string; name: string }[] = (() => {
    if (!agentsListing.ok) return [];
    const seen = new Set<string>();
    const out: { toolkit: string; name: string }[] = [];
    for (const a of agentsListing.agents) {
      if (!a.ok) continue;
      if (a.spec.framework !== "pydantic-agentspec") continue;
      for (const conn of a.spec.connections) {
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
  // ?composio=…&result=…&detail=…. Re-render the inline banner here.
  const composioParam = typeof sp.composio === "string" ? sp.composio : undefined;
  const resultParam = typeof sp.result === "string" ? sp.result : undefined;
  const detailParam = typeof sp.detail === "string" ? sp.detail : undefined;
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

      <ComposioConnectionsSection
        workspaceSlug={workspace.slug}
        connections={myConnections}
        declaredSlots={declaredSlots}
        catalog={catalog}
        composioEnabled={Boolean(composioPreview)}
        banner={composioBanner}
      />
    </div>
  );
}
