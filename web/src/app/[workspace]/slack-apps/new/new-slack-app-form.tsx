"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createSlackAppAction, type SlackAppFormState } from "../actions";

type Member = { userId: string; label: string };

const INITIAL: SlackAppFormState = {};

export function NewSlackAppForm({
  workspaceSlug,
  members,
}: {
  workspaceSlug: string;
  members: Member[];
}) {
  // On success the action redirects to the new app's detail view, so this
  // state only ever carries validation errors.
  const [state, action, pending] = useActionState(createSlackAppAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
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
          Runs act as the Slack user (matched by email) when possible, else this
          member&apos;s connections.
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
