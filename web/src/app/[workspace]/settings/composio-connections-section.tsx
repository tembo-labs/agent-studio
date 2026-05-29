import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { toolkitLabel, type CatalogToolkit } from "@/lib/composio";
import { type WorkspaceComposioConnection } from "@/lib/composio-connections";
import type { McpTool } from "@/lib/mcp-tools";

import { ToolkitPicker } from "../connections/toolkit-picker";
import { DisconnectComposioConnectionForm } from "./disconnect-composio-connection-form";
import { RefreshComposioToolsForm } from "./refresh-composio-tools-form";
import { RenameComposioConnectionForm } from "./rename-composio-connection-form";

// Settings → Connections (basic mode, Composio-backed, per-user).
//
// Each row is a (toolkit, name) slot — declared by an agent in the
// repo or already authorized by the current user. Two truths drive
// the list: what's already authorized by the current user (from the
// DB) and what's declared by the workspace's agents (from the repo
// scan in page.tsx). The union becomes the rendered set.
//
// The Phase A TAS-owned ConnectionsSection stays in the codebase as
// the future "advanced mode" surface; v0.3 only ships Composio.

type Props = {
  workspaceSlug: string;
  /** Connections owned by the current session user, in this workspace. */
  connections: WorkspaceComposioConnection[];
  /** (toolkit, name) pairs declared by agents in the connected repo. */
  declaredSlots: { toolkit: string; name: string }[];
  /** Full Composio toolkit catalog for the "Add another" picker. */
  catalog: CatalogToolkit[];
  composioEnabled: boolean;
  banner?: {
    toolkit: string;
    result: "ok" | "error";
    detail?: string;
  };
  /** Cached tool lists keyed by `${source}:${provider}:${connectionName}`.
   *  Connections page builds this once; we lift the per-row slice here. */
  toolsBySlot?: Map<string, McpTool[]>;
};

type SlotKey = string; // `${toolkit}:${name}`

export function ComposioConnectionsSection({
  workspaceSlug,
  connections,
  declaredSlots,
  catalog,
  composioEnabled,
  banner,
  toolsBySlot,
}: Props) {
  // Index of slot → connection the current user has.
  const ownedSlots = new Map<SlotKey, WorkspaceComposioConnection>();
  for (const c of connections) {
    ownedSlots.set(`${c.toolkit}:${c.name}`, c);
  }
  // Slug → logo URL lookup so each row can render the toolkit's
  // logo from Composio's catalog. Empty when the catalog hasn't
  // loaded (no API key, fetch failed); rows fall back to no icon.
  const logoBySlug = new Map<string, string>();
  for (const t of catalog) {
    if (t.logo) logoBySlug.set(t.slug, t.logo);
  }

  // Union of declared + owned slots, sorted so unfulfilled-declared
  // pairs surface first (they're the actionable ones), then owned,
  // then by name.
  const allSlots: { toolkit: string; name: string }[] = [];
  const seen = new Set<SlotKey>();
  for (const s of declaredSlots) {
    const key = `${s.toolkit}:${s.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    allSlots.push(s);
  }
  for (const c of connections) {
    const key = `${c.toolkit}:${c.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    allSlots.push({ toolkit: c.toolkit, name: c.name });
  }
  allSlots.sort((a, b) => {
    const aOwned = ownedSlots.has(`${a.toolkit}:${a.name}`) ? 1 : 0;
    const bOwned = ownedSlots.has(`${b.toolkit}:${b.name}`) ? 1 : 0;
    if (aOwned !== bOwned) return aOwned - bOwned;
    if (a.toolkit !== b.toolkit) return a.toolkit.localeCompare(b.toolkit);
    return a.name.localeCompare(b.name);
  });

  return (
    <Section
      title="Composio connections"
      description="Composio-managed OAuth across ~250 services. Composio wraps each provider's REST API as MCP tools and holds the credentials in their vault — easier to add coverage breadth, but the tool surface lags providers that ship official MCP servers (use Native MCP for those)."
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
                href="https://dashboard.composio.dev"
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground underline underline-offset-2"
              >
                dashboard.composio.dev
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

        {allSlots.length === 0 ? (
          <p className="text-foreground-weak text-base">
            No agents in this workspace declare a{" "}
            <code className="bg-surface rounded px-1 py-0.5 text-xs">
              connections:
            </code>{" "}
            field yet. Once an agent does, the toolkit it needs shows up
            here for you to authorize.
          </p>
        ) : (
          allSlots.map((slot) => {
            const key = `${slot.toolkit}:${slot.name}`;
            const owned = ownedSlots.get(key);
            return (
              <ComposioConnectionRow
                key={key}
                toolkit={slot.toolkit}
                name={slot.name}
                logoUrl={logoBySlug.get(slot.toolkit) ?? null}
                workspaceSlug={workspaceSlug}
                connection={owned}
                enabled={composioEnabled}
                tools={
                  owned
                    ? toolsBySlot?.get(
                        `composio:${owned.toolkit}:${owned.name}`,
                      ) ?? []
                    : []
                }
              />
            );
          })
        )}

        {composioEnabled && (
          <AddAnotherConnectionForm
            workspaceSlug={workspaceSlug}
            catalog={catalog}
          />
        )}
      </div>
    </Section>
  );
}

/**
 * Pre-authorize a named connection slot without waiting on an agent
 * to declare it. The same /api/connections/composio/authorize route
 * the row-level "Connect" buttons use — this just lets the user
 * supply an ad-hoc (toolkit, name) pair. Form submits GET to the
 * authorize route; toolkit picker is a client component that
 * filters Composio's catalog.
 */
function AddAnotherConnectionForm({
  workspaceSlug,
  catalog,
}: {
  workspaceSlug: string;
  catalog: CatalogToolkit[];
}) {
  return (
    <form
      action="/api/connections/composio/authorize"
      method="get"
      className="bg-surface border-border flex flex-col gap-2 rounded-lg border border-dashed px-3 py-3"
    >
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground text-sm font-medium">
          Add another Composio connection
        </span>
        <span className="text-foreground-muted text-sm">
          Pre-authorize a toolkit before an agent declares it, or attach a
          second account of a toolkit you already use (e.g. a second Gmail).
          Name distinguishes the slot when you have more than one of a
          toolkit.
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <label
            htmlFor="add-toolkit"
            className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
          >
            Toolkit
          </label>
          <ToolkitPicker fieldName="toolkit" catalog={catalog} />
        </div>
        <div className="flex min-w-[140px] flex-1 flex-col gap-1">
          <label
            htmlFor="add-name"
            className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
          >
            Name
          </label>
          <input
            id="add-name"
            name="name"
            type="text"
            required
            pattern="[a-z0-9_-]+"
            autoComplete="off"
            spellCheck={false}
            placeholder="work"
            defaultValue="default"
            className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
          />
        </div>
        <button
          type="submit"
          className="bg-[#EB7500] text-[#FFFFFF]/92 hover:bg-[#FF9933] rounded-md px-3 py-1.5 text-sm font-medium shadow-[0_0_0_1px_#AF4C00,0_-1px_2px_0_rgba(255,255,255,0.12)_inset,0_1px_2px_0_rgba(255,255,255,0.16)_inset]"
        >
          Connect
        </button>
      </div>
    </form>
  );
}

function ComposioConnectionRow({
  toolkit,
  name,
  logoUrl,
  workspaceSlug,
  connection,
  enabled,
  tools,
}: {
  toolkit: string;
  name: string;
  logoUrl: string | null;
  workspaceSlug: string;
  connection: WorkspaceComposioConnection | undefined;
  enabled: boolean;
  tools: McpTool[];
}) {
  const params = new URLSearchParams({
    workspace: workspaceSlug,
    toolkit,
  });
  if (name !== "default") params.set("name", name);
  const authorizeHref = `/api/connections/composio/authorize?${params.toString()}`;

  // Status line — always shows the slot name (incl. "default") so
  // users with multiple slots can tell which is which at a glance.
  const subtitle = connection ? (
    <>
      <span className="text-foreground-weak font-medium">{name}</span>
      <span> · </span>
      Status: {connection.status} · updated{" "}
      <LocalTime iso={connection.updatedAt.toISOString()} style="relative" />
    </>
  ) : enabled ? (
    <>
      <span className="text-foreground-weak font-medium">{name}</span>
      <span> · </span>
      Declared by an agent in this repo. Authorize to enable runs.
    </>
  ) : (
    "Set the Composio API key below first."
  );

  const toolCount = tools.length;
  const lastRefreshed =
    tools.length > 0
      ? tools.reduce(
          (latest, t) => (t.refreshedAt > latest ? t.refreshedAt : latest),
          tools[0].refreshedAt,
        )
      : null;

  return (
    <div className="bg-surface border-border flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {logoUrl ? (
          // Plain <img> to skip Next.js Image host-whitelist config;
          // these are small icons where optimization isn't critical.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            aria-hidden
            className="bg-surface-raised h-7 w-7 shrink-0 rounded-md object-contain p-1"
          />
        ) : (
          <span
            aria-hidden
            className="bg-surface-raised h-7 w-7 shrink-0 rounded-md"
          />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-foreground text-sm font-medium">
            {toolkitLabel(toolkit)}
          </span>
          <span className="text-foreground-muted truncate text-xs">
            {subtitle}
          </span>
          {connection && (
            toolCount > 0 ? (
              <p className="text-foreground-weak text-sm">
                <Link
                  href={`/${workspaceSlug}/tools?source=composio&provider=${encodeURIComponent(toolkit)}&connection=${encodeURIComponent(connection.name)}`}
                  className="text-foreground hover:text-foreground-title font-medium hover:underline"
                >
                  {toolCount} tools available
                </Link>
                {lastRefreshed && (
                  <>
                    {" · refreshed "}
                    <LocalTime
                      iso={lastRefreshed.toISOString()}
                      style="relative"
                    />
                  </>
                )}
              </p>
            ) : (
              <p className="text-foreground-weak text-sm">
                No tools cached yet — click Refresh to populate.
              </p>
            )
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 justify-items-end gap-x-4 gap-y-1">
        {connection && (
          <RefreshComposioToolsForm
            workspaceSlug={workspaceSlug}
            connectionId={connection.id}
            label={toolCount > 0 ? "Refresh tools" : "Refresh"}
          />
        )}
        {enabled && (
          <Link
            href={authorizeHref}
            className="text-foreground hover:text-foreground-title text-sm font-medium hover:underline"
          >
            {connection ? "Reconnect" : "Connect"}
          </Link>
        )}
        {connection && (
          <RenameComposioConnectionForm
            workspaceSlug={workspaceSlug}
            connectionId={connection.id}
            currentName={connection.name}
          />
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
