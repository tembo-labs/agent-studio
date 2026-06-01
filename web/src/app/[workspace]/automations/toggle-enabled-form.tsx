"use client";

// One-click enable/disable. A native checkbox in a form that submits
// the toggle action — the form's onChange handler fires the action
// immediately rather than waiting for a save button. The action
// revalidates, so the row re-renders with the new state.

import { useTransition } from "react";

import { toggleAutomationAction } from "./actions";

export function ToggleEnabledForm({
  workspaceSlug,
  id,
  enabled,
}: {
  workspaceSlug: string;
  id: string;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    const fd = new FormData();
    fd.set("workspace", workspaceSlug);
    fd.set("id", id);
    fd.set("enabled", next ? "true" : "false");
    startTransition(() => toggleAutomationAction(fd));
  };

  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
      <input
        type="checkbox"
        checked={enabled}
        onChange={handleChange}
        disabled={pending}
        className="h-3.5 w-3.5"
      />
      <span className="text-foreground-weak">{enabled ? "On" : "Off"}</span>
    </label>
  );
}
