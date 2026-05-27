import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { McpProvider } from "@/lib/mcp-providers";
import type { WorkspaceConnection } from "@/lib/connections";
import { type WorkspaceRole } from "@/lib/rbac";

import { ConfigureOAuthClientForm } from "./configure-oauth-client-form";
import { DisconnectNativeMcpConnectionForm } from "./disconnect-native-mcp-connection-form";

// Per-provider Native-MCP card. Each provider exists in three states:
//
//   1. OAuth client not configured     → admin sees Configure form;
//                                        operator/viewer sees an
//                                        "Ask your admin" hint.
//   2. Client configured, user not yet authorized
//                                      → Connect button initiates
//                                        the OAuth flow.
//   3. User authorized                 → Connected affordance plus
//                                        Disconnect.
//
// Source-of-truth for the provider catalog is lib/mcp-providers.ts;
// new providers add a catalog entry + a per-provider Configure-form
// row gains nothing custom (the form template substitutes the
// provider's setup instructions verbatim).

type Props = {
  workspaceSlug: string;
  providers: {
    provider: McpProvider;
    oauthClientConfigured: boolean;
    /** User's own authorized connection for this provider, if any. */
    connection: WorkspaceConnection | null;
  }[];
  currentUserRole: WorkspaceRole;
  banner?: {
    provider: string;
    result: "ok" | "error";
    detail?: string;
  };
};

export function NativeMcpConnectionsSection({
  workspaceSlug,
  providers,
  currentUserRole,
  banner,
}: Props) {
  const isAdmin = currentUserRole === "workspace_admin";

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
          {providers.map(({ provider, oauthClientConfigured, connection }) => (
            <ProviderRow
              key={provider.slug}
              workspaceSlug={workspaceSlug}
              provider={provider}
              oauthClientConfigured={oauthClientConfigured}
              connection={connection}
              isAdmin={isAdmin}
            />
          ))}
        </ul>
      </div>
    </Section>
  );
}

function ProviderRow({
  workspaceSlug,
  provider,
  oauthClientConfigured,
  connection,
  isAdmin,
}: {
  workspaceSlug: string;
  provider: McpProvider;
  oauthClientConfigured: boolean;
  connection: WorkspaceConnection | null;
  isAdmin: boolean;
}) {
  // Three-way render decision keyed off oauthClientConfigured +
  // connection presence. Each branch lays out one row.
  if (!oauthClientConfigured) {
    return (
      <li className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
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
            OAuth client not configured.{" "}
            {isAdmin
              ? "Set the client ID + secret below to enable the Connect button."
              : "Ask a workspace admin to set it up."}
          </p>
        </div>
        {isAdmin && (
          <details className="sm:max-w-[55%]">
            <summary className="text-foreground hover:text-foreground-strong cursor-pointer text-sm font-medium">
              Configure
            </summary>
            <div className="mt-3">
              <ConfigureOAuthClientForm
                workspaceSlug={workspaceSlug}
                provider={provider}
              />
            </div>
          </details>
        )}
      </li>
    );
  }

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
            OAuth client ready. Click Connect to authorize your account.
          </p>
        </div>
        <Button asChild variant="primary" size="small">
          <Link href={authorizeHref}>Connect</Link>
        </Button>
      </li>
    );
  }

  // Authorized: show connected state + disconnect. The reconnect
  // path is "disconnect, then click Connect again" — simpler than
  // mirroring Composio's three-button (Disconnect/Reconnect/Rename)
  // row until we hear users actually want it for native MCP.
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
      </div>
      <DisconnectNativeMcpConnectionForm
        workspaceSlug={workspaceSlug}
        connectionId={connection.id}
      />
    </li>
  );
}
