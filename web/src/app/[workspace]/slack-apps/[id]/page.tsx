import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicOrigin } from "@/lib/config";
import { getServerSession } from "@/lib/session";
import { getSlackApp, type SlackApp } from "@/lib/slack-apps";
import {
  getWorkspaceBySlug,
  getWorkspaceRole,
  listWorkspaceMembers,
} from "@/lib/workspace";

import { manifestJson } from "../manifest";
import { ManifestBlock } from "./manifest-block";

export const dynamic = "force-dynamic";

export default async function SlackAppDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; id: string }>;
  searchParams: Promise<{ slack?: string; detail?: string }>;
}) {
  const { workspace: slug, id } = await params;
  const { slack: installResult, detail: installDetail } = await searchParams;
  const session = await getServerSession();
  if (!session) notFound();
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const role = await getWorkspaceRole(workspace.id, session.user.id);
  if (role !== "workspace_admin") notFound();

  const app = await getSlackApp(workspace.id, id);
  if (!app) notFound();

  const members = await listWorkspaceMembers(workspace.id);
  const owner = members.find((m) => m.userId === app.defaultOwnerUserId);
  const ownerLabel = owner?.name ?? owner?.email ?? "—";

  const origin = getPublicOrigin();
  const base = `${origin}/api/slack/${app.id}`;
  const credsSet =
    app.hasSigningSecret && app.hasClientSecret && Boolean(app.clientId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <BackLink href={`/${workspace.slug}/slack-apps`} label="Slack apps" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
              {app.name}
            </h1>
            <Badge variant={statusVariant(app.status)} size="small">
              {app.status}
            </Badge>
          </div>
          <Button asChild variant="secondary">
            <Link href={`/${workspace.slug}/slack-apps/${app.id}/edit`}>
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {installResult === "installed" && (
        <div className="border-sentiment-positive rounded-lg border bg-[var(--color-sentiment-positive-subtle)] px-3 py-2 text-sm">
          <span className="text-foreground">Slack app installed.</span>
        </div>
      )}
      {installResult === "error" && (
        <div className="border-sentiment-negative rounded-lg border bg-[var(--color-input-error)] px-3 py-2 text-sm">
          <span className="text-foreground">
            Install failed{installDetail ? `: ${installDetail}` : "."}
          </span>
        </div>
      )}

      {/* At-a-glance config */}
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        <Row label="Default owner">{ownerLabel}</Row>
        <Row label="Agent labels">
          {app.agentLabels.length > 0 ? app.agentLabels.join(", ") : "no labels"}
        </Row>
        <Row label="Slack app ID">
          <code className="text-foreground">{app.slackAppId ?? "—"}</code>
        </Row>
        <Row label="Credentials">
          {credsSet ? "set" : "not set — add them in Edit"}
        </Row>
      </dl>

      {app.status !== "installed" && (
        <ol className="flex list-none flex-col gap-2 rounded-lg border border-[var(--color-border-weak)] bg-[var(--color-surface-secondary)] p-3 text-sm">
          <li className="text-foreground font-medium">Finish setup</li>
          <SetupStep done={Boolean(app.slackAppId)}>
            Create the Slack app — open{" "}
            <a
              href="https://api.slack.com/apps?new_app=1"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2"
            >
              api.slack.com → Create New App → From a manifest
            </a>
            , choose your Slack workspace, and paste the manifest below.
          </SetupStep>
          <SetupStep done={credsSet}>
            In the new app&apos;s{" "}
            <span className="font-medium">Basic Information</span>, copy the{" "}
            <span className="font-medium">Signing Secret</span> and the{" "}
            <span className="font-medium">App Credentials</span> (Client ID +
            Client Secret) into{" "}
            <Link
              href={`/${workspace.slug}/slack-apps/${app.id}/edit`}
              className="underline underline-offset-2"
            >
              Edit
            </Link>
            , then Save. (Optional: paste the Slack App ID too.)
          </SetupStep>
          <SetupStep done={app.hasBotToken}>
            Click <span className="font-medium">Add to Slack</span> below to
            install the bot into your Slack workspace.
          </SetupStep>
        </ol>
      )}

      {/* Request URLs to paste into the Slack app config. */}
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-foreground-weak font-medium">Request URLs</span>
        {(
          [
            ["Slash command", `${base}/commands`],
            ["Events", `${base}/events`],
            ["Interactivity", `${base}/interactivity`],
            ["OAuth redirect", `${base}/callback`],
          ] as const
        ).map(([label, url]) => (
          <div key={label} className="flex flex-wrap items-baseline gap-2">
            <span className="text-foreground-muted w-28 shrink-0">{label}</span>
            <code className="text-foreground break-all">{url}</code>
          </div>
        ))}
      </div>

      <ManifestBlock manifest={manifestJson(app, origin)} />

      {credsSet && (
        <div>
          <a
            href={`${base}/install?ws=${encodeURIComponent(workspace.slug)}`}
            className="text-foreground text-sm font-medium hover:underline"
          >
            {app.hasBotToken ? "Reinstall" : "Add to Slack"} →
          </a>
        </div>
      )}
    </div>
  );
}

function statusVariant(status: SlackApp["status"]) {
  return status === "installed" ? "green" : status === "disabled" ? "gray" : "yellow";
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="text-foreground-weak">{children}</dd>
    </>
  );
}

function SetupStep({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={done ? "text-sentiment-positive" : "text-foreground-muted"}
        aria-hidden
      >
        {done ? "✓" : "○"}
      </span>
      <span className={done ? "text-foreground-muted" : "text-foreground-weak"}>
        {children}
      </span>
    </li>
  );
}
