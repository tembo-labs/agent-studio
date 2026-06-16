import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { BackLink } from "@/components/back-link";
import { LocalTime } from "@/components/local-time";
import { McpProviderLogo } from "@/components/mcp-provider-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toolkitLabel } from "@/lib/composio-label";
import { resolveConnectionsView } from "@/lib/connections-view";
import { getMcpProvider } from "@/lib/mcp-providers";
import { listToolsForConnection } from "@/lib/mcp-tools";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import {
  loadConnection,
  parseConnectionRef,
  type StatusVariant,
} from "../connection-ref";
import { DisconnectComposioConnectionForm } from "../../settings/disconnect-composio-connection-form";
import { RefreshComposioToolsForm } from "../../settings/refresh-composio-tools-form";
import { DisconnectNativeMcpConnectionForm } from "../disconnect-native-mcp-connection-form";
import { RefreshNativeMcpToolsForm } from "../refresh-native-mcp-tools-form";

export const dynamic = "force-dynamic";

export default async function ConnectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace: slug, id } = await params;
  const sp = await searchParams;

  const session = await getServerSession();
  if (!session) notFound();
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const ref = parseConnectionRef(id);
  if (!ref) notFound();

  const requestedUser = typeof sp.user === "string" ? sp.user : undefined;
  const view = await resolveConnectionsView(
    workspace.id,
    session.user.id,
    requestedUser,
  );
  const loaded = await loadConnection(workspace.id, view.userId, ref);
  if (!loaded) notFound();

  const userQs = view.viewingOther
    ? `?user=${encodeURIComponent(view.userId)}`
    : "";
  const editHref = `/${workspace.slug}/connections/${id}/edit${userQs}`;
  const resultParam = typeof sp.result === "string" ? sp.result : undefined;
  const detailParam = typeof sp.detail === "string" ? sp.detail : undefined;

  let header: ReactNode;
  let body: ReactNode;

  if (loaded.kind === "secret") {
    const s = loaded.secret;
    header = (
      <Title logoSlug={null} title={s.slug} typeLabel="Secret" />
    );
    body = (
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        <Row label="Value">
          <code className="text-foreground">••••••••{s.last4}</code>
        </Row>
        {s.description && <Row label="Description">{s.description}</Row>}
        <Row label="Updated">
          <LocalTime iso={s.updatedAt} />
        </Row>
        <Row label="Used by agents">
          <code className="text-foreground">
            tas_tools.secret(&quot;{s.slug}&quot;)
          </code>
        </Row>
      </dl>
    );
  } else if (loaded.kind === "native") {
    const c = loaded.conn;
    const provider = getMcpProvider(c.type);
    const tools = await listToolsForConnection(
      workspace.id,
      view.userId,
      "native-mcp",
      c.type,
      c.name,
    );
    const isManual = provider?.authMode === "manual";
    const reconnect = `/api/connections/native/${c.type}/authorize?workspace=${encodeURIComponent(
      workspace.slug,
    )}&${isManual ? "app" : "name"}=${encodeURIComponent(c.name)}`;
    header = (
      <Title
        logoSlug={c.type}
        title={provider?.displayName ?? c.type}
        slot={c.name}
        typeLabel="Native MCP"
        statusLabel={c.status}
        statusVariant={nativeVariant(c.status)}
      />
    );
    body = (
      <>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <Row label="Auth">{c.authType === "pat" ? "API key" : "OAuth"}</Row>
          <Row label="Connected">
            <LocalTime iso={c.createdAt.toISOString()} />
          </Row>
          {c.tokenExpiresAt && (
            <Row label="Token expires">
              <LocalTime iso={c.tokenExpiresAt.toISOString()} />
            </Row>
          )}
          <Row label="Tools">
            <Link
              href={`/${workspace.slug}/tools?source=native-mcp&provider=${encodeURIComponent(
                c.type,
              )}&connection=${encodeURIComponent(c.name)}`}
              className="text-foreground underline underline-offset-2"
            >
              {tools.length} cached
            </Link>
          </Row>
        </dl>
        <div className="flex flex-wrap items-center gap-4">
          <RefreshNativeMcpToolsForm
            workspaceSlug={workspace.slug}
            connectionId={c.id}
          />
          {!view.viewingOther && (
            <>
              <a
                href={reconnect}
                className="text-foreground-weak hover:text-foreground text-sm underline underline-offset-2"
              >
                Reconnect →
              </a>
              <DisconnectNativeMcpConnectionForm
                workspaceSlug={workspace.slug}
                connectionId={c.id}
              />
            </>
          )}
        </div>
      </>
    );
  } else {
    const c = loaded.conn;
    const tools = await listToolsForConnection(
      workspace.id,
      view.userId,
      "composio",
      c.toolkit,
      c.name,
    );
    const reconnect = `/api/connections/composio/authorize?workspace=${encodeURIComponent(
      workspace.slug,
    )}&toolkit=${encodeURIComponent(c.toolkit)}&name=${encodeURIComponent(c.name)}`;
    header = (
      <Title
        logoSlug={c.toolkit}
        title={toolkitLabel(c.toolkit)}
        slot={c.name}
        typeLabel="Composio"
        statusLabel={c.status.toLowerCase()}
        statusVariant={c.status.toLowerCase() === "active" ? "green" : "yellow"}
      />
    );
    body = (
      <>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <Row label="Updated">
            <LocalTime iso={c.updatedAt.toISOString()} />
          </Row>
          <Row label="Tools">
            <Link
              href={`/${workspace.slug}/tools?source=composio&provider=${encodeURIComponent(
                c.toolkit,
              )}&connection=${encodeURIComponent(c.name)}`}
              className="text-foreground underline underline-offset-2"
            >
              {tools.length} cached
            </Link>
          </Row>
        </dl>
        <div className="flex flex-wrap items-center gap-4">
          <RefreshComposioToolsForm
            workspaceSlug={workspace.slug}
            connectionId={c.id}
          />
          {!view.viewingOther && (
            <>
              <a
                href={reconnect}
                className="text-foreground-weak hover:text-foreground text-sm underline underline-offset-2"
              >
                Reconnect →
              </a>
              <DisconnectComposioConnectionForm
                workspaceSlug={workspace.slug}
                connectionId={c.id}
              />
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <BackLink
          href={`/${workspace.slug}/connections${userQs}`}
          label="Connections"
        />
        <div className="flex items-start justify-between gap-3">
          {header}
          {!view.viewingOther && (
            <Button asChild variant="secondary" size="small">
              <Link href={editHref}>Edit</Link>
            </Button>
          )}
        </div>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {resultParam === "ok" && (
        <div className="border-sentiment-positive rounded-lg border bg-[var(--color-sentiment-positive-subtle)] px-3 py-2 text-sm">
          <span className="text-foreground">Connected.</span>
        </div>
      )}
      {resultParam === "error" && (
        <div className="border-sentiment-negative rounded-lg border bg-[var(--color-input-error)] px-3 py-2 text-sm">
          <span className="text-foreground">
            Connection failed{detailParam ? `: ${detailParam}` : "."}
          </span>
        </div>
      )}

      {body}
    </div>
  );
}

function nativeVariant(
  status: "active" | "stale" | "expired" | "revoked",
): StatusVariant {
  return status === "active"
    ? "green"
    : status === "revoked"
      ? "red"
      : "yellow";
}

function Title({
  logoSlug,
  title,
  slot,
  typeLabel,
  statusLabel,
  statusVariant,
}: {
  logoSlug: string | null;
  title: string;
  slot?: string;
  typeLabel: string;
  statusLabel?: string;
  statusVariant?: StatusVariant;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {logoSlug ? (
        <McpProviderLogo slug={logoSlug} label={title} size={24} />
      ) : (
        <span
          className="bg-surface-secondary text-foreground-muted inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-sm"
          aria-hidden
        >
          ⚿
        </span>
      )}
      <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
        {title}
      </h1>
      {slot && <span className="text-foreground-muted text-base">· {slot}</span>}
      {statusLabel && statusVariant && (
        <Badge variant={statusVariant} size="small">
          {statusLabel}
        </Badge>
      )}
      <span className="text-foreground-muted text-xs uppercase tracking-wide">
        {typeLabel}
      </span>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="text-foreground-weak">{children}</dd>
    </>
  );
}
