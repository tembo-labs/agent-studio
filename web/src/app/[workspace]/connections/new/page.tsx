import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { Button } from "@/components/ui/button";
import {
  listAllToolkits,
  type CatalogToolkit,
} from "@/lib/composio";
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

import { AddNativeMcpConnectionForm } from "../add-native-mcp-connection-form";
import { ConnectNativeMcpAppForm } from "../connect-native-mcp-app-form";
import { ToolkitPicker } from "../toolkit-picker";
import { SecretAddForm } from "./secret-add-form";

export const dynamic = "force-dynamic";

// One screen to add any kind of connection: a native-MCP provider (DCR or a
// manual BYO-app provider), a Composio toolkit, or a workspace secret. Connects
// are always for the acting user (the list hides "+ New" when an admin is
// viewing another member).
export default async function NewConnectionPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
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
  const isVisible = (p: McpProvider): boolean => {
    if (!isProviderAdminEnabled(p, enableMap)) return false;
    if (p.authMode === "manual") {
      return (instancesByProvider.get(p.slug)?.length ?? 0) > 0;
    }
    return true;
  };
  // DCR + self-key (named-slot) providers feed the native picker; self-key
  // (Tembo) is a single "default" slot so it joins the dropdown too.
  const addableProviders = catalog.filter(
    (p) => p.authMode !== "manual" && isVisible(p),
  );
  // Manual providers: connectable instances, or a "needs setup" note.
  const manualProviders = catalog.filter((p) => p.authMode === "manual");

  // Composio toolkit catalog only when a key is configured.
  const toolkitCatalog: CatalogToolkit[] = composioPreview
    ? await getWorkspaceSecretPlaintext(workspace.id, "composio_api_key")
        .then((k) => listAllToolkits(k))
        .catch(() => [])
    : [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-2">
        <BackLink href={`/${workspace.slug}/connections`} label="Connections" />
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          New connection
        </h1>
        <p className="text-foreground-weak text-base">
          Authorize a provider over OAuth, or store an API-key secret. OAuth
          connections are yours; secrets are shared across the workspace.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {/* Native MCP — DCR + self-key */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-foreground font-medium">Native MCP</h2>
          <p className="text-foreground-muted text-sm">
            Connect directly to a provider&apos;s official MCP server with
            TAS-managed OAuth.
          </p>
        </div>
        {addableProviders.length > 0 ? (
          <AddNativeMcpConnectionForm
            workspaceSlug={workspace.slug}
            catalog={addableProviders}
          />
        ) : (
          <p className="text-foreground-muted text-sm">
            No native-MCP providers are enabled.{" "}
            {isAdmin && (
              <Link
                href={`/${workspace.slug}/connections/providers`}
                className="text-foreground underline underline-offset-2"
              >
                Enable some →
              </Link>
            )}
          </p>
        )}
        {manualProviders.map((p) => {
          const instances = instancesByProvider.get(p.slug) ?? [];
          return (
            <div
              key={p.slug}
              className="border-border bg-surface flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <span className="text-foreground text-sm font-medium">
                {p.displayName}
              </span>
              {instances.length > 0 ? (
                <ConnectNativeMcpAppForm
                  workspaceSlug={workspace.slug}
                  providerSlug={p.slug}
                  instances={instances}
                />
              ) : isAdmin ? (
                <Link
                  href={`/${workspace.slug}/connections/providers`}
                  className="text-foreground-weak hover:text-foreground text-sm underline underline-offset-2"
                >
                  Configure OAuth app →
                </Link>
              ) : (
                <span className="text-foreground-muted text-sm">
                  Needs an admin to set up
                </span>
              )}
            </div>
          );
        })}
      </section>

      {/* Composio */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-foreground font-medium">Composio</h2>
          <p className="text-foreground-muted text-sm">
            Authorize a toolkit through Composio&apos;s hosted OAuth.
          </p>
        </div>
        {composioPreview ? (
          <form
            method="get"
            action="/api/connections/composio/authorize"
            className="bg-surface border-border flex flex-col gap-2 rounded-lg border border-dashed px-3 py-3"
          >
            <input type="hidden" name="workspace" value={workspace.slug} />
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-[180px] flex-1 flex-col gap-1">
                <label className="text-foreground-weak text-sm font-medium uppercase tracking-wide">
                  Toolkit
                </label>
                <ToolkitPicker fieldName="toolkit" catalog={toolkitCatalog} />
              </div>
              <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                <label
                  htmlFor="composio-name"
                  className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
                >
                  Name
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
              <Button type="submit" variant="primary" size="small">
                Connect
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
      </section>

      {/* Secret */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-foreground font-medium">Secret</h2>
          <p className="text-foreground-muted text-sm">
            Store an API key or token for tools that authenticate with a static
            secret. Shared across the workspace.
          </p>
        </div>
        {isAdmin ? (
          <SecretAddForm workspaceSlug={workspace.slug} />
        ) : (
          <p className="text-foreground-muted text-sm">
            Only workspace admins can add secrets.
          </p>
        )}
      </section>
    </div>
  );
}
