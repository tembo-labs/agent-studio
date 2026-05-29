import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { McpProvider } from "@/lib/mcp-providers";
import type { WorkspaceConnection } from "@/lib/connections";
import type { McpTool } from "@/lib/mcp-tools";

import { AddNativeMcpConnectionForm } from "./add-native-mcp-connection-form";
import { DisconnectNativeMcpConnectionForm } from "./disconnect-native-mcp-connection-form";
import { RefreshNativeMcpToolsForm } from "./refresh-native-mcp-tools-form";
import { RenameNativeMcpConnectionForm } from "./rename-native-mcp-connection-form";

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
};

export function NativeMcpConnectionsSection({
  workspaceSlug,
  providers,
  catalog,
  banner,
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
              // Provider slug isn't unique once a user has multiple
              // slots; suffix with the connection name (or "new" for
              // the placeholder row) so React's reconciler can tell
              // sibling rows apart.
              key={`${provider.slug}:${connection?.name ?? "new"}`}
              workspaceSlug={workspaceSlug}
              provider={provider}
              connection={connection}
              tools={tools}
            />
          ))}
        </ul>

        <AddNativeMcpConnectionForm
          workspaceSlug={workspaceSlug}
          catalog={catalog}
        />
      </div>
    </Section>
  );
}

function ProviderRow({
  workspaceSlug,
  provider,
  connection,
  tools,
}: {
  workspaceSlug: string;
  provider: McpProvider;
  connection: WorkspaceConnection | null;
  tools: McpTool[];
}) {
  if (!connection) {
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
          <p className="text-foreground-weak text-xs">
            Click Connect to log in with your {provider.displayName} account.
          </p>
        </div>
        <Button asChild variant="primary" size="small">
          <Link href={authorizeHref}>Connect</Link>
        </Button>
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
          <code className="text-foreground-muted text-[11px]">
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
        <p className="text-foreground-weak text-xs">
          Connected{" "}
          <LocalTime iso={connection.createdAt.toISOString()} />
          {connection.tokenExpiresAt && (
            <>
              {" · token expires "}
              <LocalTime iso={connection.tokenExpiresAt.toISOString()} />
            </>
          )}
        </p>

        {toolCount > 0 ? (
          <details className="text-xs">
            <summary className="text-foreground-weak hover:text-foreground cursor-pointer select-none">
              <span className="text-foreground font-medium">{toolCount}</span>{" "}
              tools available
              {lastRefreshed && (
                <>
                  {" · refreshed "}
                  <LocalTime iso={lastRefreshed.toISOString()} />
                </>
              )}
            </summary>
            <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-2">
              {tools.map((t) => (
                <li
                  key={t.slug}
                  className="border-border-weak border-l-2 pl-2"
                >
                  <code className="text-foreground text-[11px]">{t.slug}</code>
                  {t.description && (
                    <p className="text-foreground-weak mt-0.5 text-[11px]">
                      {t.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="text-foreground-weak text-xs">
            No tools cached yet — click Refresh to populate.
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        <RefreshNativeMcpToolsForm
          workspaceSlug={workspaceSlug}
          connectionId={connection.id}
          label={toolCount > 0 ? "Refresh tools" : "Refresh"}
        />
        <RenameNativeMcpConnectionForm
          workspaceSlug={workspaceSlug}
          connectionId={connection.id}
          currentName={connection.name}
        />
        <DisconnectNativeMcpConnectionForm
          workspaceSlug={workspaceSlug}
          connectionId={connection.id}
        />
      </div>
    </li>
  );
}
