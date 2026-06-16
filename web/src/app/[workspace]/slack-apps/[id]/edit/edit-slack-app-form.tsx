"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SlackApp } from "@/lib/slack-apps";

import {
  deleteSlackAppAction,
  updateSlackAppAction,
  type SlackAppFormState,
} from "../../actions";

type Member = { userId: string; label: string };

const INITIAL: SlackAppFormState = {};

export function EditSlackAppForm({
  workspaceSlug,
  app,
  members,
}: {
  workspaceSlug: string;
  app: SlackApp;
  members: Member[];
}) {
  // On success the action redirects back to the detail view.
  const [state, action, pending] = useActionState(updateSlackAppAction, INITIAL);
  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="workspace" value={workspaceSlug} />
        <input type="hidden" name="id" value={app.id} />
        <div className="grid gap-1.5">
          <Label htmlFor="slack-name" className="text-sm">
            App name
          </Label>
          <Input
            id="slack-name"
            name="name"
            defaultValue={app.name}
            disabled={pending}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Slack app ID"
            name="slack_app_id"
            defaultValue={app.slackAppId ?? ""}
            placeholder="A0123456789"
          />
          <Field
            label="Client ID"
            name="client_id"
            defaultValue={app.clientId ?? ""}
            placeholder="123…"
          />
          <Field
            label={`Signing secret${app.hasSigningSecret ? " (set)" : ""}`}
            name="signing_secret"
            type="password"
            placeholder={
              app.hasSigningSecret
                ? "•••• (leave blank to keep)"
                : "from Slack → Basic Information"
            }
          />
          <Field
            label={`Client secret${app.hasClientSecret ? " (set)" : ""}`}
            name="client_secret"
            type="password"
            placeholder={
              app.hasClientSecret
                ? "•••• (leave blank to keep)"
                : "from Slack → Basic Information"
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <div className="border-t border-[var(--color-border-weak)] pt-4">
        <form action={deleteSlackAppAction}>
          <input type="hidden" name="workspace" value={workspaceSlug} />
          <input type="hidden" name="id" value={app.id} />
          <button
            type="submit"
            className="text-foreground-weak hover:text-sentiment-negative text-sm"
          >
            Delete this Slack app
          </button>
        </form>
      </div>
    </div>
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
