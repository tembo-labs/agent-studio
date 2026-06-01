"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  setupInstanceNameAction,
  type InstanceSettingsState,
} from "@/app/settings/actions";

// First-run only: name the instance before any account exists. Server
// action is gated on first-run, so this is inert once a user exists.
export function SetupInstanceNameForm({
  initialName,
  envFallback,
}: {
  initialName: string;
  envFallback: string;
}) {
  const [state, action, pending] = useActionState<
    InstanceSettingsState,
    FormData
  >(setupInstanceNameAction, { ok: false });
  const [value, setValue] = useState(initialName);

  return (
    <form action={action} className="flex flex-col gap-2">
      <Input
        name="instanceName"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={envFallback}
        maxLength={120}
        autoComplete="off"
        aria-label="Instance name"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="medium" disabled={pending}>
          {pending ? "Saving…" : "Save name"}
        </Button>
        {state.saved && !pending && (
          <span className="text-sentiment-positive text-sm">Saved.</span>
        )}
        {state.error && !pending && (
          <span className="text-sentiment-negative text-sm">{state.error}</span>
        )}
      </div>
    </form>
  );
}
