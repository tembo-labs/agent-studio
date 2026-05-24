"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  connectRepoAction,
  type ConnectRepoFormState,
} from "./actions";

const INITIAL: ConnectRepoFormState = {};

export function ConnectRepoForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, formAction, pending] = useActionState(
    connectRepoAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="workspace" value={workspaceSlug} />

      <div className="grid gap-1.5">
        <Label htmlFor="repo" className="text-sm">
          GitHub repository
        </Label>
        <Input
          id="repo"
          name="repo"
          type="text"
          autoComplete="off"
          spellCheck={false}
          required
          disabled={pending}
          placeholder="github.com/owner/repo"
        />
        <p className="text-foreground-muted text-xs">
          The repo where this workspace&apos;s agent definitions will live.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="token" className="text-sm">
          GitHub personal access token
        </Label>
        <Input
          id="token"
          name="token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          disabled={pending}
          placeholder="ghp_… or github_pat_…"
        />
        <p className="text-foreground-muted text-xs">
          Needs read + write on this repo. Classic tokens want the{" "}
          <code className="bg-surface rounded px-1 py-0.5">repo</code> scope;
          fine-grained tokens want <em>Contents: read &amp; write</em>. Stored
          encrypted at rest.
        </p>
      </div>

      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        className="mt-1 w-full"
      >
        {pending ? "Validating…" : "Connect repository"}
      </Button>
    </form>
  );
}
