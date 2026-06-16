import Link from "next/link";
import { notFound } from "next/navigation";

import { IconPlusLarge } from "central-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getServerSession } from "@/lib/session";
import { listSlackApps, type SlackApp } from "@/lib/slack-apps";
import { getWorkspaceBySlug, getWorkspaceRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Slack apps: TAS-managed bots that launch a label-scoped subset of this
// workspace's agents from Slack (slash command + picker). Admin-only. This is
// the list view — one clickable row per app; the detail view holds setup,
// credentials, and install. Moved out of Settings into the Build menu.
export default async function SlackAppsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const session = await getServerSession();
  if (!session) notFound();
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const role = await getWorkspaceRole(workspace.id, session.user.id);
  const isAdmin = role === "workspace_admin";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Slack apps
        </h1>
        <p className="text-foreground-weak text-base">
          TAS-managed Slack bots that launch a label-scoped subset of this
          workspace&apos;s agents (slash command + picker). Run one bot per team
          — e.g. a sales bot and a support bot.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {!isAdmin ? (
        <p className="text-foreground-weak text-sm">
          Only workspace admins can manage Slack apps.
        </p>
      ) : (
        <SlackAppsList workspaceSlug={workspace.slug} apps={await listSlackApps(workspace.id)} />
      )}
    </div>
  );
}

function SlackAppsList({
  workspaceSlug,
  apps,
}: {
  workspaceSlug: string;
  apps: SlackApp[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button asChild>
          <Link href={`/${workspaceSlug}/slack-apps/new`}>
            <IconPlusLarge size={16} />
            <span>New Slack app</span>
          </Link>
        </Button>
      </div>

      {apps.length > 0 ? (
        <div className="flex flex-col gap-2">
          {apps.map((app) => (
            <SlackAppRow key={app.id} app={app} workspaceSlug={workspaceSlug} />
          ))}
        </div>
      ) : (
        <p className="text-foreground-muted rounded-lg border border-dashed border-[var(--color-border)] px-3 py-10 text-center text-sm">
          No Slack apps yet. Create one to launch agents from Slack.
        </p>
      )}
    </div>
  );
}

function statusVariant(status: SlackApp["status"]) {
  return status === "installed" ? "green" : status === "disabled" ? "gray" : "yellow";
}

function SlackAppRow({
  app,
  workspaceSlug,
}: {
  app: SlackApp;
  workspaceSlug: string;
}) {
  return (
    <Link
      href={`/${workspaceSlug}/slack-apps/${app.id}`}
      className="border-border bg-surface hover:bg-surface-secondary group flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-foreground group-hover:underline font-medium">
          {app.name}
        </span>
        <Badge variant={statusVariant(app.status)} size="small">
          {app.status}
        </Badge>
        <span className="text-foreground-muted truncate text-sm">
          {app.agentLabels.length > 0 ? app.agentLabels.join(", ") : "no labels"}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {app.status !== "installed" && (
          <span className="text-[var(--color-sentiment-caution)] text-sm">
            Finish setup
          </span>
        )}
        <span className="text-foreground-muted text-sm" aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}
