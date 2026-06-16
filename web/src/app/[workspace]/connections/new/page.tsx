import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { IconApiConnection } from "central-icons";

import { BackLink } from "@/components/back-link";
import { McpProviderLogo } from "@/components/mcp-provider-logo";
import { Button } from "@/components/ui/button";
import { listAllToolkits, type CatalogToolkit } from "@/lib/composio";
import { listMcpProviders, type McpProvider } from "@/lib/mcp-providers";
import {
  getProviderEnableMap,
  isProviderAdminEnabled,
} from "@/lib/native-mcp-providers-admin";
import { listNativeOAuthClients } from "@/lib/native-oauth-clients";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceBySlug,
  getWorkspaceRole,
  getWorkspaceSecretPlaintext,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { ConnectNativeMcpAppForm } from "../connect-native-mcp-app-form";
import { ToolkitPicker } from "../toolkit-picker";
import { NativeConnectForm } from "./native-connect-form";
import { SecretAddForm } from "./secret-add-form";

export const dynamic = "force-dynamic";

// Add a connection in two steps: pick what to connect (a native-MCP provider,
// Composio, or a secret), then fill in that option's form. The picker is the
// default view; ?provider=<slug> or ?type=composio|secret drills into a form.
export default async function NewConnectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ provider?: string; type?: string }>;
}) {
  const { workspace: slug } = await params;
  const { provider: providerParam, type: typeParam } = await searchParams;

  const session = await getServerSession();
  if (!session) notFound();
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const isAdmin =
    (await getWorkspaceRole(workspace.id, session.user.id)) ===
    "workspace_admin";

  const [oauthClients, enableMap, composioPreview] = await Promise.all([
    listNativeOAuthClients(workspace.id),
    getProviderEnableMap(workspace.id),
    getWorkspaceSecretPreview(workspace.id, "composio_api_key"),
  ]);
  const instancesByProvider = new Map<
    string,
    { instance: string; label: string | null }[]
  >();
  for (const c of oauthClients) {
    const arr = instancesByProvider.get(c.provider) ?? [];
    arr.push({ instance: c.instance, label: c.label });
    instancesByProvider.set(c.provider, arr);
  }
  const catalog = listMcpProviders();

  // ── A specific option's form ────────────────────────────────────────
  if (providerParam || typeParam) {
    const back = (
      <BackLink
        href={`/${workspace.slug}/connections/new`}
        label="New connection"
      />
    );

    if (providerParam) {
      const provider = catalog.find((p) => p.slug === providerParam);
      if (!provider || !isProviderAdminEnabled(provider, enableMap)) notFound();
      const instances = instancesByProvider.get(provider.slug) ?? [];
      return (
        <FormShell
          back={back}
          title={`Connect ${provider.displayName}`}
          logo={
            <McpProviderLogo
              slug={provider.slug}
              label={provider.displayName}
              size={24}
            />
          }
        >
          {provider.authMode === "manual" ? (
            instances.length > 0 ? (
              <ConnectNativeMcpAppForm
                workspaceSlug={workspace.slug}
                providerSlug={provider.slug}
                instances={instances}
              />
            ) : isAdmin ? (
              <p className="text-foreground-weak text-sm">
                {provider.displayName} needs an OAuth app first.{" "}
                <Link
                  href={`/${workspace.slug}/connections/providers`}
                  className="text-foreground underline underline-offset-2"
                >
                  Configure it on Manage providers →
                </Link>
              </p>
            ) : (
              <p className="text-foreground-muted text-sm">
                {provider.displayName} needs an admin to set up its OAuth app
                first.
              </p>
            )
          ) : (
            <NativeConnectForm
              workspaceSlug={workspace.slug}
              providerSlug={provider.slug}
              selfKey={provider.authMode === "self-key"}
            />
          )}
        </FormShell>
      );
    }

    if (typeParam === "composio") {
      const toolkitCatalog: CatalogToolkit[] = composioPreview
        ? await getWorkspaceSecretPlaintext(workspace.id, "composio_api_key")
            .then((k) => listAllToolkits(k))
            .catch(() => [])
        : [];
      return (
        <FormShell
          back={back}
          title="Connect a Composio toolkit"
          logo={<IconApiConnection size={24} className="text-foreground-muted" />}
        >
          {composioPreview ? (
            <form
              method="get"
              action="/api/connections/composio/authorize"
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="workspace" value={workspace.slug} />
              <div className="grid gap-1.5">
                <label className="text-foreground-weak text-sm font-medium">
                  Toolkit
                </label>
                <ToolkitPicker fieldName="toolkit" catalog={toolkitCatalog} />
              </div>
              <div className="grid gap-1.5">
                <label
                  htmlFor="composio-name"
                  className="text-foreground-weak text-sm font-medium"
                >
                  Connection name
                </label>
                <input
                  id="composio-name"
                  name="name"
                  type="text"
                  defaultValue="default"
                  pattern="[a-z0-9_-]+"
                  autoComplete="off"
                  spellCheck={false}
                  className="bg-input border-border text-foreground rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)]"
                />
              </div>
              <div>
                <Button type="submit" variant="primary">
                  Connect →
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-foreground-muted text-sm">
              Composio needs a workspace API key.{" "}
              <Link
                href={`/${workspace.slug}/settings/composio`}
                className="text-foreground underline underline-offset-2"
              >
                Set it in Settings →
              </Link>
            </p>
          )}
        </FormShell>
      );
    }

    if (typeParam === "secret") {
      return (
        <FormShell back={back} title="Add a secret" logo={<Glyph />}>
          {isAdmin ? (
            <SecretAddForm workspaceSlug={workspace.slug} />
          ) : (
            <p className="text-foreground-muted text-sm">
              Only workspace admins can add secrets.
            </p>
          )}
        </FormShell>
      );
    }

    notFound();
  }

  // ── The picker ──────────────────────────────────────────────────────
  const providerCards = catalog.filter((p) =>
    isProviderAdminEnabled(p, enableMap),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <BackLink href={`/${workspace.slug}/connections`} label="Connections" />
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          New connection
        </h1>
        <p className="text-foreground-weak text-base">
          Pick what to connect. OAuth connections are yours; secrets are shared
          across the workspace.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <div className="grid gap-2 sm:grid-cols-2">
        {providerCards.map((p) => (
          <OptionCard
            key={p.slug}
            href={`/${workspace.slug}/connections/new?provider=${encodeURIComponent(p.slug)}`}
            logo={
              <McpProviderLogo slug={p.slug} label={p.displayName} size={24} />
            }
            title={p.displayName}
            sublabel={authModeLabel(p)}
          />
        ))}
        <OptionCard
          href={`/${workspace.slug}/connections/new?type=composio`}
          logo={<IconApiConnection size={24} className="text-foreground-muted" />}
          title="Composio toolkit"
          sublabel="300+ apps via Composio"
        />
        {isAdmin && (
          <OptionCard
            href={`/${workspace.slug}/connections/new?type=secret`}
            logo={<Glyph />}
            title="Secret / API key"
            sublabel="Static key for custom tools"
          />
        )}
      </div>
    </div>
  );
}

function authModeLabel(p: McpProvider): string {
  if (p.authMode === "manual") return "OAuth · your app";
  if (p.authMode === "self-key") return "Built-in";
  return "OAuth";
}

function OptionCard({
  href,
  logo,
  title,
  sublabel,
}: {
  href: string;
  logo: ReactNode;
  title: string;
  sublabel: string;
}) {
  return (
    <Link
      href={href}
      className="border-border bg-surface hover:bg-surface-secondary group flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {logo}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-foreground group-hover:underline font-medium">
          {title}
        </span>
        <span className="text-foreground-muted truncate text-sm">
          {sublabel}
        </span>
      </span>
    </Link>
  );
}

function FormShell({
  back,
  title,
  logo,
  children,
}: {
  back: ReactNode;
  title: string;
  logo: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        {back}
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center">
            {logo}
          </span>
          <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
            {title}
          </h1>
        </div>
      </div>
      <hr className="border-[var(--color-border-weak)]" />
      {children}
    </div>
  );
}

function Glyph() {
  return (
    <span
      className="bg-surface-secondary text-foreground-muted inline-flex h-6 w-6 items-center justify-center rounded text-sm"
      aria-hidden
    >
      ⚿
    </span>
  );
}
