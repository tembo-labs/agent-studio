import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { McpProviderLogo } from "@/components/mcp-provider-logo";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { McpProvider } from "@/lib/mcp-providers";
import type { WorkspaceConnection } from "@/lib/connections";
import type { McpTool } from "@/lib/mcp-tools";

import { AddNativeMcpConnectionForm } from "./add-native-mcp-connection-form";
import { ConnectNativeMcpAppForm } from "./connect-native-mcp-app-form";
import { DisconnectNativeMcpConnectionForm } from "./disconnect-native-mcp-connection-form";
import { RefreshNativeMcpToolsForm } from "./refresh-native-mcp-tools-form";
import { RenameNativeMcpConnectionForm } from "./rename-native-mcp-connection-form";

// A visible manual provider plus the OAuth-app instances a user can connect.
export type ManualConnectTarget = {
  provider: McpProvider;
  instances: { instance: string; label: string | null }[];
};

// Per-provider Native-MCP card. Each provider is in one of two states:
//
//   1. User not yet authorized → Connect (DCR providers initiate the OAuth
//      flow directly; manual providers pick an admin-registered OAuth app
//      instance via the connect-app form below).
//   2. User authorized          → Connected affordance + Disconnect.
//
// Admin OAuth-app setup + provider enable/disable lives on the separate
// "Manage providers" screen (native-mcp/admin), reached from the header.

type Props = {
  workspaceSlug: string;
  /** Connected rows (one per (provider, name) slot) plus a placeholder Connect
   *  row for each visible DCR provider with no connections. Manual providers'
   *  connect affordance is rendered separately (manualConnect). */
  providers: {
    provider: McpProvider;
    connection: WorkspaceConnection | null;
    tools: McpTool[];
  }[];
  /** Visible DCR providers — feeds the "Add another" named-slot picker. */
  addableProviders: McpProvider[];
  /** Visible manual providers + their connectable app instances. */
  manualConnect: ManualConnectTarget[];
  banner?: {
    provider: string;
    result: "ok" | "error";
    detail?: string;
  };
  /** Admin viewing another member: rename + refresh only. */
  viewingOther?: boolean;
};

export function NativeMcpConnectionsSection({
  workspaceSlug,
  providers,
  addableProviders,
  manualConnect,
  banner,
  viewingOther = false,
}: Props) {
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

        <ul className="divide-border bg-surface border-border flex flex-col divide-y overflow-hidden rounded-lg border">
          {providers.map(({ provider, connection, tools }) => (
            <ProviderRow
              key={`${provider.slug}:${connection?.name ?? "new"}`}
              workspaceSlug={workspaceSlug}
              provider={provider}
              connection={connection}
              tools={tools}
              viewingOther={viewingOther}
            />
          ))}
          {/* Connect a manual (BYO-app) provider against a registered instance. */}
          {!viewingOther &&
            manualConnect.map(({ provider, instances }) => (
              <li
                key={`connect:${provider.slug}`}
                className="flex items-baseline justify-between gap-3 px-3 py-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <McpProviderLogo
                      slug={provider.slug}
                      label={provider.displayName}
                      size={18}
                    />
                    <span className="text-foreground text-sm font-medium">
                      {provider.displayName}
                    </span>
                    <Badge variant="gray" size="small">
                      Native MCP
                    </Badge>
                  </div>
                  <p className="text-foreground-weak text-sm">
                    {instances.length > 1
                      ? `Pick a ${provider.displayName} app and connect your account.`
                      : `Connect your ${provider.displayName} account.`}
                  </p>
                </div>
                <ConnectNativeMcpAppForm
                  workspaceSlug={workspaceSlug}
                  providerSlug={provider.slug}
                  instances={instances}
                />
              </li>
            ))}
        </ul>

        {!viewingOther && addableProviders.length > 0 && (
          <AddNativeMcpConnectionForm
            workspaceSlug={workspaceSlug}
            catalog={addableProviders}
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
}: {
  workspaceSlug: string;
  provider: McpProvider;
  connection: WorkspaceConnection | null;
  tools: McpTool[];
  viewingOther?: boolean;
}) {
  const isManual = provider.authMode === "manual";
  const isSelfKey = provider.authMode === "self-key";

  if (!connection) {
    // Placeholder "Connect" rows are DCR-only (manual providers connect via the
    // instance form). Not actionable for an admin viewing someone else.
    if (viewingOther) return null;
    const authorizeHref = `/api/connections/native/${provider.slug}/authorize?workspace=${encodeURIComponent(
      workspaceSlug,
    )}`;
    return (
      <li className="flex items-baseline justify-between gap-3 px-3 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <McpProviderLogo
              slug={provider.slug}
              label={provider.displayName}
              size={18}
            />
            <span className="text-foreground text-sm font-medium">
              {provider.displayName}
            </span>
            <Badge variant="gray" size="small">
              Native MCP
            </Badge>
          </div>
          <p className="text-foreground-weak text-sm">
            {isSelfKey
              ? "Connect to let your agents manage agents, runs, and automations on your behalf — they act with your workspace role."
              : `Click Connect to log in with your ${provider.displayName} account.`}
          </p>
        </div>
        <Button asChild variant="primary" size="small">
          <Link href={authorizeHref}>Connect</Link>
        </Button>
      </li>
    );
  }

  // Authorized: show connected state + cached tool list + disconnect.
  const toolCount = tools.length;
  const lastRefreshed =
    tools.length > 0
      ? tools.reduce(
          (latest, t) => (t.refreshedAt > latest ? t.refreshedAt : latest),
          tools[0].refreshedAt,
        )
      : null;
  // Reconnect re-runs authorize for the same slot. Manual providers must carry
  // ?app=<instance> (the slot name is the instance); DCR carries ?name= for
  // non-default slots.
  const reconnectHref = isManual
    ? `/api/connections/native/${provider.slug}/authorize?workspace=${encodeURIComponent(
        workspaceSlug,
      )}&app=${encodeURIComponent(connection.name)}`
    : `/api/connections/native/${provider.slug}/authorize?workspace=${encodeURIComponent(
        workspaceSlug,
      )}${connection.name !== "default" ? `&name=${encodeURIComponent(connection.name)}` : ""}`;
  return (
    <li className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <McpProviderLogo
            slug={provider.slug}
            label={provider.displayName}
            size={18}
          />
          <span className="text-foreground text-sm font-medium">
            {provider.displayName}
          </span>
          <Badge variant="gray" size="small">
            Native MCP
          </Badge>
          {connection.name !== "default" && (
            <code className="text-foreground-muted text-sm">
              {connection.name}
            </code>
          )}
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
            href={reconnectHref}
            className="text-foreground hover:text-foreground-title text-sm font-medium hover:underline"
          >
            Reconnect
          </Link>
        )}
        {/* DCR slots are free-named; a manual slot IS its OAuth-app instance,
            so renaming would desync it from the app — not offered. Self-key
            (Tembo) is a single fixed "default" slot agent specs reference by
            provider, so renaming it would silently break them — not offered. */}
        {!isManual && !isSelfKey && (
          <RenameNativeMcpConnectionForm
            workspaceSlug={workspaceSlug}
            connectionId={connection.id}
            currentName={connection.name}
          />
        )}
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
