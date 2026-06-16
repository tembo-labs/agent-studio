"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RenameState = { message?: string; error?: string };
type RenameAction = (
  state: RenameState,
  formData: FormData,
) => Promise<RenameState>;

// Direct rename field shown on the connection edit page (no toggle/expand).
// Works for both native-MCP and Composio renames — the matching server action
// is passed in; both read workspace / connectionId / newName.
export function ConnectionRenameField({
  action,
  workspaceSlug,
  connectionId,
  currentName,
}: {
  action: RenameAction;
  workspaceSlug: string;
  connectionId: string;
  currentName: string;
}) {
  const [state, formAction, pending] = useActionState<RenameState, FormData>(
    action,
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="connectionId" value={connectionId} />
      <div className="grid gap-1.5">
        <Label htmlFor="rename-name" className="text-sm">
          Connection name
        </Label>
        <Input
          id="rename-name"
          name="newName"
          required
          pattern="[a-z0-9_-]+"
          autoComplete="off"
          spellCheck={false}
          defaultValue={currentName}
          disabled={pending}
        />
        <p className="text-foreground-muted text-sm">
          Update any agent file that references{" "}
          <code>{currentName}</code> to the new name, or its runs will fail to
          resolve the connection.
        </p>
      </div>
      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="text-sentiment-positive text-sm">{state.message}</p>
      )}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save name"}
        </Button>
      </div>
    </form>
  );
}
