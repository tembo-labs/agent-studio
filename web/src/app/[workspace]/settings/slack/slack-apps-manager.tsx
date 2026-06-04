"use client";

import { useActionState, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section } from "@/components/section";
import { useActionToast } from "@/lib/use-action-toast";
import type { SlackApp } from "@/lib/slack-apps";
import { SLACK_BOT_SCOPES } from "@/lib/slack-scopes";

import {
  createSlackAppAction,
  deleteSlackAppAction,
  updateSlackAppAction,
  type SlackAppFormState,
} from "./actions";

type Member = { userId: string; label: string };

const INITIAL: SlackAppFormState = {};

// Slack manifest prefilled with this app's TAS request URLs + scopes. The
// admin pastes it into "Create app from manifest" in Slack.
function manifestJson(app: SlackApp, origin: string): string {
  const base = `${origin}/api/slack/${app.id}`;
  return JSON.stringify(
    {
      display_information: { name: app.name },
      features: {
        bot_user: { display_name: app.name, always_online: true },
        slash_commands: [
          {
            command: "/tas",
            url: `${base}/commands`,
            description: "Launch a TAS agent",
            usage_hint: "[agent] [input]",
            should_escape: false,
          },
        ],
      },
      oauth_config: {
        redirect_urls: [`${base}/callback`],
        scopes: { bot: [...SLACK_BOT_SCOPES] },
      },
      settings: {
        event_subscriptions: {
          request_url: `${base}/events`,
          bot_events: ["app_mention", "message.im"],
        },
        interactivity: { is_enabled: true, request_url: `${base}/interactivity` },
        org_deploy_enabled: false,
        socket_mode_enabled: false,
        token_rotation_enabled: false,
      },
    },
    null,
    2,
  );
}

export function SlackAppsManager({
  workspaceSlug,
  origin,
  apps,
  members,
}: {
  workspaceSlug: string;
  origin: string;
  apps: SlackApp[];
  members: Member[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Slack apps"
        description="A TAS-managed Slack bot that launches a label-scoped subset of this workspace's agents (slash command + picker). Create one bot per team — e.g. sales and support."
      >
        <CreateForm workspaceSlug={workspaceSlug} members={members} />
      </Section>

      {apps.length > 0 && (
        <div className="flex flex-col gap-6">
          {apps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              origin={origin}
              workspaceSlug={workspaceSlug}
              members={members}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateForm({
  workspaceSlug,
  members,
}: {
  workspaceSlug: string;
  members: Member[];
}) {
  const [state, action, pending] = useActionState(createSlackAppAction, INITIAL);
  useActionToast(state);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <div className="grid gap-1.5">
        <Label htmlFor="slack-name" className="text-sm">
          App name
        </Label>
        <Input
          id="slack-name"
          name="name"
          required
          disabled={pending}
          placeholder="Sales bot"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="slack-owner" className="text-sm">
          Default owner
        </Label>
        <select
          id="slack-owner"
          name="default_owner"
          required
          disabled={pending}
          defaultValue=""
          className="bg-input text-foreground rounded-lg px-3 py-2 text-sm shadow-[0_0_0_1px_var(--color-border)] focus:outline-none"
        >
          <option value="" disabled>
            Pick a member…
          </option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="text-foreground-muted text-sm">
          Runs act as the Slack user (matched by email) when possible, else
          this member&apos;s connections.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="slack-labels" className="text-sm">
          Agent labels
        </Label>
        <Input
          id="slack-labels"
          name="agent_labels"
          disabled={pending}
          placeholder="sales, crm"
        />
        <p className="text-foreground-muted text-sm">
          Comma-separated. This bot can launch agents carrying any of these
          labels.
        </p>
      </div>
      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create Slack app"}
        </Button>
      </div>
    </form>
  );
}

function AppCard({
  app,
  origin,
  workspaceSlug,
  members,
}: {
  app: SlackApp;
  origin: string;
  workspaceSlug: string;
  members: Member[];
}) {
  const [state, action, pending] = useActionState(updateSlackAppAction, INITIAL);
  useActionToast(state);
  const [showManifest, setShowManifest] = useState(false);
  const base = `${origin}/api/slack/${app.id}`;
  const credsSet =
    app.hasSigningSecret && app.hasClientSecret && Boolean(app.clientId);
  const statusVariant =
    app.status === "installed"
      ? "green"
      : app.status === "disabled"
        ? "gray"
        : "yellow";

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-medium">{app.name}</span>
          <Badge variant={statusVariant} size="small">
            {app.status}
          </Badge>
        </div>
        <form action={deleteSlackAppAction}>
          <input type="hidden" name="workspace" value={workspaceSlug} />
          <input type="hidden" name="id" value={app.id} />
          <button
            type="submit"
            className="text-foreground-weak hover:text-sentiment-negative text-sm"
          >
            Delete
          </button>
        </form>
      </div>

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
            Client Secret) into the fields below, then{" "}
            <span className="font-medium">Save</span>. (Optional: paste the
            Slack App ID too.)
          </SetupStep>
          <SetupStep done={app.hasBotToken}>
            Click <span className="font-medium">Add to Slack</span> to install
            the bot into your Slack workspace.
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

      <div>
        <button
          type="button"
          onClick={() => setShowManifest((v) => !v)}
          className="text-foreground-weak hover:text-foreground text-sm underline underline-offset-2"
        >
          {showManifest ? "Hide" : "Show"} app manifest
        </button>
        {showManifest && (
          <textarea
            readOnly
            rows={14}
            value={manifestJson(app, origin)}
            className="bg-input text-foreground-strong mt-2 w-full resize-y rounded-lg p-2 font-mono text-sm shadow-[0_0_0_1px_var(--color-border)]"
          />
        )}
      </div>

      {/* Credentials + config. Secrets left blank stay unchanged. */}
      <form action={action} className="flex flex-col gap-3 border-t border-[var(--color-border-weak)] pt-4">
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <input type="hidden" name="id" value={app.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Slack app ID" name="slack_app_id" defaultValue={app.slackAppId ?? ""} placeholder="A0123456789" />
          <Field label="OAuth client ID" name="client_id" defaultValue={app.clientId ?? ""} placeholder="123…" />
          <Field
            label={`Signing secret${app.hasSigningSecret ? " (set)" : ""}`}
            name="signing_secret"
            type="password"
            placeholder={app.hasSigningSecret ? "•••• (leave blank to keep)" : "from Slack → Basic Information"}
          />
          <Field
            label={`OAuth client secret${app.hasClientSecret ? " (set)" : ""}`}
            name="client_secret"
            type="password"
            placeholder={app.hasClientSecret ? "•••• (leave blank to keep)" : "from Slack → Basic Information"}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-sm">Default owner</Label>
            <select
              name="default_owner"
              defaultValue={app.defaultOwnerUserId}
              disabled={pending}
              className="bg-input text-foreground rounded-lg px-3 py-2 text-sm shadow-[0_0_0_1px_var(--color-border)] focus:outline-none"
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Agent labels"
            name="agent_labels"
            defaultValue={app.agentLabels.join(", ")}
            placeholder="sales, crm"
          />
        </div>
        {state.error && (
          <p className="text-sentiment-negative text-sm" role="alert">
            {state.error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" size="small" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {app.hasSigningSecret && app.hasClientSecret && app.clientId && (
            <a
              href={`${base}/install?ws=${encodeURIComponent(workspaceSlug)}`}
              className="text-foreground text-sm font-medium hover:underline"
            >
              {app.hasBotToken ? "Reinstall" : "Add to Slack"} →
            </a>
          )}
        </div>
      </form>
    </div>
  );
}

function SetupStep({
  done,
  children,
}: {
  done: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={
          done ? "text-sentiment-positive" : "text-foreground-muted"
        }
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

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm">{label}</Label>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}
