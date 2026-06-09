"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestSlug } from "@/lib/slugify";

import { renameWorkspaceAction, type RenameWorkspaceState } from "./actions";

const INITIAL: RenameWorkspaceState = {};

// Rename the workspace. The URL slug follows the name (GitHub-org style), so
// we preview the resulting `/slug` live and warn when the URL will move. The
// server re-derives + validates the slug and keeps the old one as a redirect;
// this is just guidance. On a slug change the action redirects to the new URL.
export function RenameWorkspaceForm({
  workspaceSlug,
  workspaceName,
}: {
  workspaceSlug: string;
  workspaceName: string;
}) {
  const [state, formAction, pending] = useActionState(
    renameWorkspaceAction,
    INITIAL,
  );
  const [name, setName] = useState(workspaceName);

  const trimmed = name.trim();
  const nextSlug = suggestSlug(trimmed);
  const unchanged = trimmed === workspaceName;
  const slugWillChange = nextSlug !== "" && nextSlug !== workspaceSlug;

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <div className="grid gap-1.5">
        <Label htmlFor="workspace-name" className="text-sm">
          Workspace name
        </Label>
        <Input
          id="workspace-name"
          name="name"
          autoComplete="off"
          disabled={pending}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={workspaceName}
        />
      </div>

      <p className="text-foreground-muted text-sm">
        URL:{" "}
        <code className="text-foreground-weak">
          /{nextSlug || workspaceSlug}
        </code>
        {slugWillChange && (
          <>
            {" "}
            <span className="text-foreground-weak">
              (was <code>/{workspaceSlug}</code> — the old link will redirect
              here)
            </span>
          </>
        )}
      </p>

      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="text-sentiment-positive text-sm" role="status">
          {state.message}
        </p>
      )}

      <div>
        <Button type="submit" disabled={unchanged || trimmed === "" || pending}>
          {pending ? "Saving…" : "Save name"}
        </Button>
      </div>
    </form>
  );
}
