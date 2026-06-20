import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { IconCalendarRepeat, IconGlobe, IconLightning } from "central-icons";

import { BackLink } from "@/components/back-link";
import { toolkitLabel } from "@/lib/composio";
import { listConnectionsForUser } from "@/lib/composio-connections";
import { meetsMinRole } from "@/lib/rbac";
import {
  getWorkspaceRole,
  getWorkspaceSecretPreview,
  listWorkspaceMembers,
} from "@/lib/workspace";

import { loadAgentContext } from "../../agent-page-context";
import { TriggerForm } from "../../trigger-form";
import { AddWebhookForm } from "../../webhooks-section";

export const dynamic = "force-dynamic";

// Per-agent "New automation" chooser, mirroring /automations/new but scoped to
// this agent (no agent-picker step — the agent is already known). The first
// page picks one of the three TYPES (Schedule / Trigger / Webhook):
//   • Schedule  → the workspace cron form, with this agent pre-filled.
//   • Trigger / Webhook → configured on the agent, so we render their forms
//     right here. ?type=trigger / ?type=webhook show the form.
export default async function NewAgentAutomationPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; agent: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ workspace: slug, agent: agentName }, { type: typeParam }] =
    await Promise.all([params, searchParams]);

  const { session, workspace, canonicalName } = await loadAgentContext(
    slug,
    agentName,
  );

  const currentUserRole = await getWorkspaceRole(workspace.id, session.user.id);
  const canEdit = meetsMinRole(currentUserRole, "operator");
  const isAdmin = currentUserRole === "workspace_admin";

  const chooserHref = `/${workspace.slug}/agents/${encodeURIComponent(canonicalName)}/automation/new`;
  const tabHref = `/${workspace.slug}/agents/${encodeURIComponent(canonicalName)}/automation`;
  const backToTypes = <BackLink href={chooserHref} label="New automation" />;

  // ── Event trigger: the trigger form ─────────────────────────────────
  if (typeParam === "trigger") {
    const [myConnections, composioApiKeyPreview, composioWebhookSecretPreview] =
      await Promise.all([
        listConnectionsForUser(workspace.id, session.user.id),
        getWorkspaceSecretPreview(workspace.id, "composio_api_key"),
        getWorkspaceSecretPreview(workspace.id, "composio_webhook_secret"),
      ]);
    return (
      <FormShell
        back={backToTypes}
        title="New event trigger"
        description="Subscribe this agent to events from a connected service — it fires when something happens in that app."
      >
        {!composioApiKeyPreview && (
          <PreconditionNotice
            tone="alert"
            text="Set a Composio API key in Settings before creating triggers."
          />
        )}
        {composioApiKeyPreview && !composioWebhookSecretPreview && (
          <PreconditionNotice
            tone="warn"
            text="Add a Composio webhook secret in Settings so inbound events can be verified."
          />
        )}
        <TriggerForm
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
          connections={myConnections.map((c) => ({
            id: c.id,
            toolkit: c.toolkit,
            name: c.name,
            label: `${toolkitLabel(c.toolkit)} · ${c.name}`,
          }))}
          disabled={!composioApiKeyPreview}
        />
      </FormShell>
    );
  }

  // ── Webhook: the inbound-endpoint form (operator only) ──────────────
  if (typeParam === "webhook") {
    if (!canEdit) notFound();
    const allMembers = await listWorkspaceMembers(workspace.id);
    const owners = isAdmin
      ? allMembers.map((m) => ({ userId: m.userId, label: m.name ?? m.email }))
      : undefined;
    return (
      <FormShell
        back={backToTypes}
        title="New webhook"
        description="Create an inbound HTTP endpoint that fires this agent when an outside system POSTs to it."
      >
        <AddWebhookForm
          workspaceSlug={workspace.slug}
          agentName={canonicalName}
          owners={owners}
        />
      </FormShell>
    );
  }

  if (typeParam) notFound();

  // ── The type chooser (first page) ───────────────────────────────────
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <BackLink href={tabHref} label="Automations" />
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          New automation
        </h1>
        <p className="text-foreground-weak text-base">
          Pick how {canonicalName} should fire.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <div className="grid gap-2 sm:grid-cols-2">
        <OptionCard
          href={`/${workspace.slug}/automations/new?type=schedule&agent=${encodeURIComponent(canonicalName)}`}
          logo={<IconCalendarRepeat size={20} className="text-foreground-muted" />}
          title="Schedule"
          sublabel="Run on a cron"
        />
        <OptionCard
          href={`${chooserHref}?type=trigger`}
          logo={<IconLightning size={20} className="text-foreground-muted" />}
          title="Event trigger"
          sublabel="Fire on an event in a connected app"
        />
        {canEdit && (
          <OptionCard
            href={`${chooserHref}?type=webhook`}
            logo={<IconGlobe size={20} className="text-foreground-muted" />}
            title="Webhook"
            sublabel="Fire on an inbound HTTP POST"
          />
        )}
      </div>
    </div>
  );
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
  description,
  children,
}: {
  back: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        {back}
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          {title}
        </h1>
        <p className="text-foreground-weak text-base">{description}</p>
      </div>
      <hr className="border-[var(--color-border-weak)]" />
      {children}
    </div>
  );
}

function PreconditionNotice({
  tone,
  text,
}: {
  tone: "warn" | "alert";
  text: string;
}) {
  const styles =
    tone === "alert"
      ? "border-sentiment-negative bg-[var(--color-input-error)]"
      : "border-[var(--color-border-sentiment-caution)] bg-[var(--color-sentiment-caution-subtle)]";
  return (
    <div className={`mb-3 rounded-lg border px-3 py-2 text-sm ${styles}`}>
      <span className="text-foreground">{text}</span>
    </div>
  );
}
