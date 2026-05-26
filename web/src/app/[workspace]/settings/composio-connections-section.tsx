import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import {
  COMPOSIO_TOOLKITS,
  COMPOSIO_TOOLKIT_LABELS,
  type ComposioToolkit,
} from "@/lib/composio";
import { type WorkspaceComposioConnection } from "@/lib/composio-connections";

import { DisconnectComposioConnectionForm } from "./disconnect-composio-connection-form";

// Settings → Connections (basic mode, Composio-backed).
//
// Distinct from `ConnectionsSection` (Phase A, TAS-owned OAuth) which
// stays in the codebase for the future "advanced mode" but isn't
// rendered today. v0.3 ships only Composio.

type Props = {
  workspaceSlug: string;
  connections: WorkspaceComposioConnection[];
  composioEnabled: boolean;
  banner?: {
    toolkit: ComposioToolkit;
    result: "ok" | "error";
    detail?: string;
  };
};

export function ComposioConnectionsSection({
  workspaceSlug,
  connections,
  composioEnabled,
  banner,
}: Props) {
  const byToolkit = new Map(connections.map((c) => [c.toolkit, c]));

  return (
    <Section
      title="Connections"
      description="External services this workspace's agents can call at run time. Authorized once here, then referenced by name from any agent's spec. Powered by Composio — credentials live in Composio's vault."
    >
      <div id="connections" className="flex flex-col gap-3">
        {!composioEnabled && (
          <div className="border-border bg-surface rounded-lg border px-3 py-2 text-sm">
            <span className="text-foreground-weak">
              Set{" "}
              <code className="bg-surface rounded px-1 py-0.5 text-xs">
                COMPOSIO_API_KEY
              </code>{" "}
              on this TAS instance to enable connections. Get a key at{" "}
              <a
                href="https://app.composio.dev/developers"
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground underline underline-offset-2"
              >
                app.composio.dev/developers
              </a>
              .
            </span>
          </div>
        )}

        {banner && (
          <div
            role={banner.result === "error" ? "alert" : undefined}
            className={
              banner.result === "ok"
                ? "border-sentiment-positive bg-[var(--color-sentiment-positive-subtle)] rounded-lg border px-3 py-2 text-sm"
                : "border-sentiment-negative bg-[var(--color-input-error)] rounded-lg border px-3 py-2 text-sm"
            }
          >
            {banner.result === "ok" ? (
              <span className="text-foreground">
                {COMPOSIO_TOOLKIT_LABELS[banner.toolkit]} connected.
              </span>
            ) : (
              <span className="text-foreground">
                Couldn&apos;t connect{" "}
                {COMPOSIO_TOOLKIT_LABELS[banner.toolkit]}
                {banner.detail ? `: ${banner.detail}` : "."}
              </span>
            )}
          </div>
        )}

        {COMPOSIO_TOOLKITS.map((toolkit) => (
          <ComposioConnectionRow
            key={toolkit}
            toolkit={toolkit}
            workspaceSlug={workspaceSlug}
            connection={byToolkit.get(toolkit)}
            enabled={composioEnabled}
          />
        ))}
      </div>
    </Section>
  );
}

function ComposioConnectionRow({
  toolkit,
  workspaceSlug,
  connection,
  enabled,
}: {
  toolkit: ComposioToolkit;
  workspaceSlug: string;
  connection: WorkspaceComposioConnection | undefined;
  enabled: boolean;
}) {
  const label = COMPOSIO_TOOLKIT_LABELS[toolkit];
  const authorizeHref = `/api/connections/composio/authorize?workspace=${encodeURIComponent(workspaceSlug)}&toolkit=${encodeURIComponent(toolkit)}`;

  return (
    <div className="bg-surface border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-foreground text-sm font-medium">{label}</span>
        {connection ? (
          <span className="text-foreground-muted truncate text-xs">
            Status: {connection.status} · updated{" "}
            <LocalTime iso={connection.updatedAt.toISOString()} />
          </span>
        ) : (
          <span className="text-foreground-muted text-xs">
            {enabled
              ? "Not connected."
              : "Not connected. Set COMPOSIO_API_KEY to enable."}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {enabled && (
          <Link
            href={authorizeHref}
            className="text-foreground hover:text-foreground-title text-sm font-medium hover:underline"
          >
            {connection ? "Reconnect" : "Connect"}
          </Link>
        )}
        {connection && (
          <DisconnectComposioConnectionForm
            workspaceSlug={workspaceSlug}
            connectionId={connection.id}
          />
        )}
      </div>
    </div>
  );
}
