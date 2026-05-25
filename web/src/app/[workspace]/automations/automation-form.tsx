"use client";

// Shared create/edit form for an automation. Live cron preview so
// the user sees both the human description ("Every weekday at 09:00")
// and the next-fire instant rendered in their local tz before they
// commit. The cron itself is always evaluated in UTC by the
// scheduler — see lib/cron.ts.

import { useActionState, useMemo, useState } from "react";

import { LocalTime } from "@/components/local-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateCron } from "@/lib/cron";

import {
  createAutomationAction,
  updateAutomationAction,
  type AutomationFormState,
} from "./actions";

const INITIAL: AutomationFormState = {};

type AgentChoice = {
  name: string;
};

type CommonProps = {
  workspaceSlug: string;
  agents: AgentChoice[];
  defaults?: {
    id?: string;
    name?: string;
    agentName?: string;
    cron?: string;
    inputMessage?: string;
    enabled?: boolean;
  };
};

export function AutomationForm({
  workspaceSlug,
  agents,
  defaults,
  mode,
}: CommonProps & { mode: "create" | "edit" }) {
  const action = mode === "create" ? createAutomationAction : updateAutomationAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  const [cron, setCron] = useState(defaults?.cron ?? "0 9 * * 1-5");
  const preview = useMemo(() => validateCron(cron), [cron]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      {mode === "edit" && defaults?.id && (
        <input type="hidden" name="id" value={defaults.id} />
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="name" className="text-sm">
          Automation name
        </Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
          defaultValue={defaults?.name ?? ""}
          placeholder="Daily inbox sweep"
        />
        {state.fieldErrors?.name && (
          <FieldError>{state.fieldErrors.name}</FieldError>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="agent" className="text-sm">
          Agent
        </Label>
        <select
          id="agent"
          name="agent"
          required
          disabled={pending}
          defaultValue={defaults?.agentName ?? ""}
          className="bg-surface border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)] rounded-md border px-3 py-2 text-sm leading-6"
        >
          <option value="" disabled>
            Pick an agent…
          </option>
          {agents.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.agent && (
          <FieldError>{state.fieldErrors.agent}</FieldError>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="cron" className="text-sm">
          Schedule (cron, UTC)
        </Label>
        <Input
          id="cron"
          name="cron"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          placeholder="0 9 * * 1-5"
          className="font-mono"
        />
        <p className="text-foreground-muted text-xs">
          Five-field cron (minute, hour, day-of-month, month, day-of-week).
          Times are UTC.
        </p>
        <CronPreview preview={preview} />
        {state.fieldErrors?.cron && (
          <FieldError>{state.fieldErrors.cron}</FieldError>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="input_message" className="text-sm">
          Input message (optional)
        </Label>
        <textarea
          id="input_message"
          name="input_message"
          rows={3}
          disabled={pending}
          defaultValue={defaults?.inputMessage ?? ""}
          placeholder="Anything the agent should treat as the user's prompt for the run."
          className="bg-surface border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color,#009eff)] rounded-md border px-3 py-2 text-sm leading-6 resize-y"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={defaults?.enabled ?? true}
          disabled={pending}
          className="h-4 w-4"
        />
        <span className="text-foreground">Enabled</span>
        <span className="text-foreground-weak text-xs">
          (turn off to pause without deleting)
        </span>
      </label>

      {state.error && (
        <div className="border-sentiment-negative bg-[var(--color-input-error)] rounded-lg border p-3 text-sm">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function CronPreview({
  preview,
}: {
  preview: ReturnType<typeof validateCron>;
}) {
  if (!preview.ok) return null;
  return (
    <div className="text-foreground-weak flex flex-col gap-0.5 text-xs">
      <span>
        <span className="text-foreground">{preview.humanReadable}</span>{" "}
        <span className="text-foreground-muted">(UTC)</span>
      </span>
      <span>
        Next fire:{" "}
        <LocalTime iso={preview.nextFire.toISOString()} />
      </span>
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sentiment-negative text-xs">{children}</span>
  );
}
