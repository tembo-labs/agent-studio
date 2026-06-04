"use client";

import { useActionState, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
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
        app_home: {
          home_tab_enabled: true,
          messages_tab_enabled: true,
          messages_tab_read_only_enabled: false,
        },
        slash_commands: [
          {
            command: "/tas",
            url: `${base}/commands`,
            description: "Launch a TAS agent",
            usage_hint: "[agent] [input]",
            should_escape: false,
          },
        ],
        shortcuts: [
          {
            name: "Run agent on this message",
            type: "message",
            callback_id: "tas_run_on_message",
            description: "Launch a TAS agent with this message as its input",
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
          bot_events: ["app_mention", "message.im", "app_home_opened"],
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
        description="TAS-managed Slack bots that launch a label-scoped subset of this workspace's agents (slash command + picker). Run one bot per team — e.g. a sales bot and a support bot."
      >
        {apps.length > 0 ? (
          <div className="flex flex-col gap-3">
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
        ) : (
          <p className="text-foreground-muted rounded-lg border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-sm">
            No Slack apps yet. Create one below.
          </p>
        )}
      </Section>

      <Section
        title="Create a Slack app"
        description="Each app is its own Slack bot with its own identity, install, and agent scope. Name it for the team it serves, pick a default owner, and list the agent labels it may launch."
      >
        <CreateForm workspaceSlug={workspaceSlug} members={members} />
      </Section>
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
  // Apps still being set up open expanded (they need attention); installed
  // apps collapse to a compact row, expandable to edit.
  const [expanded, setExpanded] = useState(app.status !== "installed");
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
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="group flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="text-foreground-muted text-xs" aria-hidden>
            {expanded ? "▾" : "▸"}
          </span>
          <span className="text-foreground group-hover:underline font-medium">
            {app.name}
          </span>
          <Badge variant={statusVariant} size="small">
            {app.status}
          </Badge>
          <span className="text-foreground-muted truncate text-sm">
            {app.agentLabels.length > 0
              ? app.agentLabels.join(", ")
              : "no labels"}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-3">
          {!expanded && app.status !== "installed" && (
            <span className="text-[var(--color-sentiment-caution)] text-sm">
              Finish setup
            </span>
          )}
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
      </div>

      {expanded && (
        <>
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
          <div className="relative mt-2">
            <div className="absolute right-2 top-2 z-10">
              <CopyButton
                text={manifestJson(app, origin)}
                label="Copy manifest"
                ariaLabel="Copy app manifest to clipboard"
              />
            </div>
            <textarea
              readOnly
              rows={14}
              value={manifestJson(app, origin)}
              className="bg-input text-foreground-strong w-full resize-y rounded-lg p-2 pr-28 font-mono text-sm shadow-[0_0_0_1px_var(--color-border)]"
            />
          </div>
        )}
      </div>

      {/* Credentials + config. Secrets left blank stay unchanged. */}
      <form action={action} className="flex flex-col gap-3 border-t border-[var(--color-border-weak)] pt-4">
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <input type="hidden" name="id" value={app.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Slack app ID" name="slack_app_id" defaultValue={app.slackAppId ?? ""} placeholder="A0123456789" />
          <Field label="Client ID" name="client_id" defaultValue={app.clientId ?? ""} placeholder="123…" />
          <Field
            label={`Signing secret${app.hasSigningSecret ? " (set)" : ""}`}
            name="signing_secret"
            type="password"
            placeholder={app.hasSigningSecret ? "•••• (leave blank to keep)" : "from Slack → Basic Information"}
          />
          <Field
            label={`Client secret${app.hasClientSecret ? " (set)" : ""}`}
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
        </>
      )}
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
