"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { updateInstanceNameAction, type InstanceSettingsState } from "./actions";

// Controlled input on purpose: useActionState resets uncontrolled
// fields after each submit (including the error path), which would wipe
// the user's edit on a validation bounce.
export function InstanceNameForm({
  initialName,
  envFallback,
}: {
  initialName: string;
  envFallback: string;
}) {
  const [state, action, pending] = useActionState<
    InstanceSettingsState,
    FormData
  >(updateInstanceNameAction, { ok: false });
  const [value, setValue] = useState(initialName);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="instanceName"
          className="text-foreground text-sm font-medium"
        >
          Instance name
        </label>
        <Input
          id="instanceName"
          name="instanceName"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={envFallback}
          maxLength={120}
          autoComplete="off"
        />
        <p className="text-foreground-weak text-xs">
          Shown on the sign-in screen and the app header. Leave blank to use
          the default (<span className="font-medium">{envFallback}</span>).
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="medium" disabled={pending}>
          {pending ? "Saving…" : "Save"}
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
