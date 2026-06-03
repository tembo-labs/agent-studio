"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deleteWorkspaceAction, type DeleteWorkspaceState } from "./actions";

const INITIAL: DeleteWorkspaceState = {};

// Type-to-confirm delete. The button stays disabled until the typed
// name matches the workspace exactly; the server action re-checks the
// same thing (and the workspace_admin role), so the client guard is
// just to prevent fat-finger deletes. On success the action redirects
// to `/`.
export function DeleteWorkspaceForm({
  workspaceSlug,
  workspaceName,
}: {
  workspaceSlug: string;
  workspaceName: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteWorkspaceAction,
    INITIAL,
  );
  const [confirm, setConfirm] = useState("");
  const armed = confirm.trim() === workspaceName;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <div className="grid gap-1.5">
        <Label htmlFor="confirm-delete" className="text-sm">
          Type{" "}
          <span className="text-foreground font-medium">{workspaceName}</span>{" "}
          to confirm
        </Label>
        <Input
          id="confirm-delete"
          name="confirm"
          autoComplete="off"
          disabled={pending}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={workspaceName}
        />
      </div>

      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" variant="destructive" disabled={!armed || pending}>
          {pending ? "Deleting…" : "Delete this workspace"}
        </Button>
      </div>
    </form>
  );
}
