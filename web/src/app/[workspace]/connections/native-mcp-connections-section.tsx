import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { McpProvider } from "@/lib/mcp-providers";
import type { WorkspaceConnection } from "@/lib/connections";
import type { McpTool } from "@/lib/mcp-tools";

import { AddNativeMcpConnectionForm } from "./add-native-mcp-connection-form";
import { ConfigureNativeOAuthApp } from "./configure-native-oauth-app";
import { DisconnectNativeMcpConnectionForm } from "./disconnect-native-mcp-connection-form";
import { RefreshNativeMcpToolsForm } from "./refresh-native-mcp-tools-form";
import { RenameNativeMcpConnectionForm } from "./rename-native-mcp-connection-form";

// Manual (BYO OAuth app) provider config, keyed by provider slug. Only manual
// providers (e.g. HubSpot) appear here.
export type ManualAppConfig = {
  configured: boolean;
  clientId?: string;
  secretLast4?: string;
  redirectUri: string;
  setupUrl?: string;
};

// Per-provider Native-MCP card. Each provider is in one of two
// states:
//
//   1. User not yet authorized → Connect button initiates the
//                                OAuth flow (TAS performs MCP
//                                discovery + DCR + PKCE under the
//                                hood; user only sees the provider's
//                                login screen).
//   2. User authorized          → Connected affordance + Disconnect.
//
// No per-provider Configure step: TAS dynamically registers itself
// with the provider's authorization server at Connect time (RFC
// 7591). Each new provider only needs a catalog entry in
// lib/mcp-providers.ts — no per-provider OAuth-client setup, no
// per-provider authorize/callback code.

type Props = {
  workspaceSlug: string;
  /** One row per (provider, name) slot the user has authorized,
   *  plus one placeholder row per catalog provider with no
   *  connections (so first-time Connect stays discoverable). The
   *  page builds this — a user with two Attio slots gets two rows. */
  providers: {
    provider: McpProvider;
    /** Connection backing this row, or null for the "no connections
     *  for this provider yet" placeholder. */
    connection: WorkspaceConnection | null;
    /** Tools cached for this connection (empty when not connected). */
    tools: McpTool[];
  }[];
  /** Full provider catalog — feeds the "Add another" picker. */
  catalog: McpProvider[];
  banner?: {
    provider: string;
    result: "ok" | "error";
    detail?: string;
  };
  /** Admin viewing another member: rename + refresh only — hide
   *  Connect/Reconnect, Disconnect, placeholder "Connect" rows, and the
   *  "Add another" form. */
  viewingOther?: boolean;
  /** BYO-OAuth-app config for manual providers (e.g. HubSpot), keyed by slug. */
  manualConfig?: Record<string, ManualAppConfig>;
  /** Whether the current user can configure OAuth apps (workspace admin). */
  isAdmin?: boolean;
};

export function NativeMcpConnectionsSection({
  workspaceSlug,
  providers,
  catalog,
  banner,
  viewingOther = false,
  manualConfig = {},
  isAdmin = false,
}: Props) {
  // Manual providers (HubSpot) need a one-time admin OAuth-app config before
  // anyone can Connect. Show the config cards above the rows for admins.
  const manualProviders = catalog.filter((p) => p.authMode === "manual");
  return (
    <Section
      title="Native MCP connections"
      description="TAS-managed OAuth + direct connection to each provider's official MCP server. Richer than the wrapped REST surface — providers expose aggregations, schema-aware operations, and the tools they actually optimized for LLMs."
    >
      <div className="flex flex-col gap-4">
        {banner && (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              banner.result === "ok"
                ? "border-sentiment-positive bg-[var(--color-sentiment-positive-subtle)]"
                : "border-sentiment-negative bg-[var(--color-input-error)]"
            }`}
          >
            <span className="text-foreground">
              {banner.result === "ok"
                ? `Connected ${banner.provider}.`
                : `Couldn't connect ${banner.provider}${banner.detail ? `: ${banner.detail}` : "."}`}
            </span>
          </div>
        )}

        {!viewingOther &&
          isAdmin &&
          manualProviders.map((provider) => {
            const cfg = manualConfig[provider.slug];
            if (!cfg) return null;
            return (
              <ConfigureNativeOAuthApp
                key={`cfg:${provider.slug}`}
                workspaceSlug={workspaceSlug}
                providerSlug={provider.slug}
                providerDisplayName={provider.displayName}
                redirectUri={cfg.redirectUri}
                clientId={cfg.clientId}
                secretLast4={cfg.secretLast4}
                setupUrl={cfg.setupUrl}
              />
            );
          })}

        <ul className="divide-border bg-surface border-border flex flex-col divide-y overflow-hidden rounded-lg border">
          {providers.map(({ provider, connection, tools }) => (
            <ProviderRow
              // Provider slug isn't unique once a user has multiple
              // slots; suffix with the connection name (or "new" for
              // the placeholder row) so React's reconciler can tell
              // sibling rows apart.
              key={`${provider.slug}:${connection?.name ?? "new"}`}
              workspaceSlug={workspaceSlug}
              provider={provider}
              connection={connection}
              tools={tools}
              viewingOther={viewingOther}
              needsOAuthApp={
                provider.authMode === "manual" &&
                !manualConfig[provider.slug]?.configured
              }
            />
          ))}
        </ul>

        {!viewingOther && (
          <AddNativeMcpConnectionForm
            workspaceSlug={workspaceSlug}
            catalog={catalog}
          />
        )}
      </div>
    </Section>
  );
}

function ProviderRow({
  workspaceSlug,
  provider,
  connection,
  tools,
  viewingOther = false,
  needsOAuthApp = false,
}: {
  workspaceSlug: string;
  provider: McpProvider;
  connection: WorkspaceConnection | null;
  tools: McpTool[];
  viewingOther?: boolean;
  /** Manual provider whose workspace OAuth app isn't configured yet. */
  needsOAuthApp?: boolean;
}) {
  if (!connection) {
    // Placeholder "Connect" rows aren't actionable for an admin viewing
    // someone else (OAuth must be the member) — drop them entirely.
    if (viewingOther) return null;
    const authorizeHref = `/api/connections/native/${provider.slug}/authorize?workspace=${encodeURIComponent(
      workspaceSlug,
    )}`;
    return (
      <li className="flex items-baseline justify-between gap-3 px-3 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-sm font-medium">
              {provider.displayName}
            </span>
            <Badge variant="gray" size="small">
              Native MCP
            </Badge>
          </div>
          <p className="text-foreground-weak text-sm">
            {needsOAuthApp
              ? `An admin must configure the ${provider.displayName} OAuth app before you can connect.`
              : `Click Connect to log in with your ${provider.displayName} account.`}
          </p>
        </div>
        {needsOAuthApp ? (
          <Button variant="primary" size="small" disabled>
            Connect
          </Button>
        ) : (
          <Button asChild variant="primary" size="small">
            <Link href={authorizeHref}>Connect</Link>
          </Button>
        )}
      </li>
    );
  }

  // Authorized: show connected state + cached tool list + disconnect.
  // Reconnect path is "disconnect, then click Connect again" —
  // simpler than mirroring Composio's three-button row until we
  // hear users want it for native MCP.
  const toolCount = tools.length;
  const lastRefreshed =
    tools.length > 0
      ? tools.reduce(
          (latest, t) => (t.refreshedAt > latest ? t.refreshedAt : latest),
          tools[0].refreshedAt,
        )
      : null;
  return (
    <li className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-foreground text-sm font-medium">
            {provider.displayName}
          </span>
          <Badge variant="gray" size="small">
            Native MCP
          </Badge>
          <code className="text-foreground-muted text-sm">
            {connection.name}
          </code>
          {connection.status === "active" ? (
            <Badge variant="green" size="small">
              Active
            </Badge>
          ) : (
            <Badge variant="red" size="small">
              {connection.status}
            </Badge>
          )}
        </div>
        <p className="text-foreground-weak text-sm">
          Connected{" "}
          <LocalTime iso={connection.createdAt.toISOString()} style="relative" />
          {connection.tokenExpiresAt && (
            <>
              {" · token expires "}
              <LocalTime iso={connection.tokenExpiresAt.toISOString()} style="relative" />
            </>
          )}
        </p>

        {toolCount > 0 ? (
          <p className="text-foreground-weak text-sm">
            <Link
              href={`/${workspaceSlug}/tools?source=native-mcp&provider=${encodeURIComponent(provider.slug)}&connection=${encodeURIComponent(connection.name)}`}
              className="text-foreground hover:text-foreground-title font-medium hover:underline"
            >
              {toolCount} tools available
            </Link>
            {lastRefreshed && (
              <>
                {" · refreshed "}
                <LocalTime iso={lastRefreshed.toISOString()} style="relative" />
              </>
            )}
          </p>
        ) : (
          <p className="text-foreground-weak text-sm">
            No tools cached yet — click Refresh to populate.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 justify-items-end gap-x-4 gap-y-1">
        <RefreshNativeMcpToolsForm
          workspaceSlug={workspaceSlug}
          connectionId={connection.id}
          label={toolCount > 0 ? "Refresh tools" : "Refresh"}
        />
        {!viewingOther && (
          <Link
            // Same authorize endpoint the first-time Connect uses —
            // re-running discovery + DCR + PKCE replaces the row's
            // tokens via the callback's saveNativeConnection upsert.
            // Needed for Native MCP because tokens expire (Attio's
            // are hours), and reconnecting beats waiting for the
            // next run to fail with a 401.
            href={`/api/connections/native/${provider.slug}/authorize?workspace=${encodeURIComponent(
              workspaceSlug,
            )}${connection.name !== "default" ? `&name=${encodeURIComponent(connection.name)}` : ""}`}
            className="text-foreground hover:text-foreground-title text-sm font-medium hover:underline"
          >
            Reconnect
          </Link>
        )}
        <RenameNativeMcpConnectionForm
          workspaceSlug={workspaceSlug}
          connectionId={connection.id}
          currentName={connection.name}
        />
        {!viewingOther && (
          <DisconnectNativeMcpConnectionForm
            workspaceSlug={workspaceSlug}
            connectionId={connection.id}
          />
        )}
      </div>
    </li>
  );
}
