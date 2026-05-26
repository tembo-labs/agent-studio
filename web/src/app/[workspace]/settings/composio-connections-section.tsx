import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { toolkitLabel, type ComposioToolkit } from "@/lib/composio";
import { type WorkspaceComposioConnection } from "@/lib/composio-connections";

import { DisconnectComposioConnectionForm } from "./disconnect-composio-connection-form";

// Settings → Connections (basic mode, Composio-backed).
//
// Distinct from `ConnectionsSection` (Phase A, TAS-owned OAuth) which
// stays in the codebase for the future "advanced mode" but isn't
// rendered today. v0.3 ships only Composio.
//
// The toolkit list is data-driven: callers pass `declaredToolkits`
// — every Composio slug referenced by any agent in the connected
// repo. We union those with the workspace's existing connections so
// the section also shows authorized-but-no-longer-used toolkits
// (with a hint that they're idle), and surfaces a Connect affordance
// for declared-but-not-yet-authorized ones. This is what lets Tembo
// invent new toolkits in agent files without a TAS code change.

type Props = {
  workspaceSlug: string;
  connections: WorkspaceComposioConnection[];
  /** Toolkit slugs declared by agents in the connected repo. */
  declaredToolkits: string[];
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
  declaredToolkits,
  composioEnabled,
  banner,
}: Props) {
  const byToolkit = new Map(connections.map((c) => [c.toolkit, c]));

  // Sort: connected first, then declared-but-not-connected (so the
  // user sees what they still need to authorize), then anything else.
  // Dedup case-insensitively on slug.
  const declared = new Set(
    declaredToolkits.map((t) => t.trim().toLowerCase()).filter(Boolean),
  );
  const allSlugs = new Set<string>([
    ...connections.map((c) => c.toolkit),
    ...declared,
  ]);
  const rows = [...allSlugs].sort((a, b) => {
    const aConn = byToolkit.has(a) ? 0 : 1;
    const bConn = byToolkit.has(b) ? 0 : 1;
    if (aConn !== bConn) return aConn - bConn;
    return a.localeCompare(b);
  });

  return (
    <Section
      title="Connections"
      description="External services this workspace's agents can call at run time. The list below is driven by the agents in your connected repo — declare a toolkit in an agent's `connections:` field and it shows up here. Powered by Composio; credentials live in Composio's vault."
    >
      <div id="connections" className="flex flex-col gap-3">
        {!composioEnabled && (
          <div className="border-border bg-surface rounded-lg border px-3 py-2 text-sm">
            <span className="text-foreground-weak">
              Set the{" "}
              <strong className="text-foreground font-medium">
                Composio API key
              </strong>{" "}
              below to enable connections. Get a key at{" "}
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
                {toolkitLabel(banner.toolkit)} connected.
              </span>
            ) : (
              <span className="text-foreground">
                Couldn&apos;t connect {toolkitLabel(banner.toolkit)}
                {banner.detail ? `: ${banner.detail}` : "."}
              </span>
            )}
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-foreground-weak text-sm">
            No agents in this workspace declare a{" "}
            <code className="bg-surface rounded px-1 py-0.5 text-xs">
              connections:
            </code>{" "}
            field yet. Once an agent does, the toolkit it needs shows up
            here for you to authorize.
          </p>
        ) : (
          rows.map((toolkit) => (
            <ComposioConnectionRow
              key={toolkit}
              toolkit={toolkit}
              workspaceSlug={workspaceSlug}
              connection={byToolkit.get(toolkit)}
              declared={declared.has(toolkit)}
              enabled={composioEnabled}
            />
          ))
        )}
      </div>
    </Section>
  );
}

function ComposioConnectionRow({
  toolkit,
  workspaceSlug,
  connection,
  declared,
  enabled,
}: {
  toolkit: ComposioToolkit;
  workspaceSlug: string;
  connection: WorkspaceComposioConnection | undefined;
  declared: boolean;
  enabled: boolean;
}) {
  const label = toolkitLabel(toolkit);
  const authorizeHref = `/api/connections/composio/authorize?workspace=${encodeURIComponent(workspaceSlug)}&toolkit=${encodeURIComponent(toolkit)}`;

  // Three states the user actually cares about:
  //   - Connected + declared: green path, "Reconnect / Disconnect"
  //   - Connected + not declared: "Idle — no agent uses this yet"
  //   - Declared + not connected: "Authorize" call to action
  const subtitle = connection
    ? declared
      ? (
          <>
            Status: {connection.status} · updated{" "}
            <LocalTime iso={connection.updatedAt.toISOString()} />
          </>
        )
      : (
          <>
            Idle — no agent in this repo references{" "}
            <code className="bg-surface rounded px-1 py-0.5 text-xs">
              {toolkit}
            </code>
            . Safe to disconnect.
          </>
        )
    : enabled
      ? "Declared by an agent in this repo. Authorize to enable runs."
      : "Set the Composio API key below first.";

  return (
    <div className="bg-surface border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-foreground text-sm font-medium">{label}</span>
        <span className="text-foreground-muted truncate text-xs">
          {subtitle}
        </span>
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
