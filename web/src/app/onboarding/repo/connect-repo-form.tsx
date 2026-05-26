"use client";

import { useActionState, useState } from "react";

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
  // React 19's useActionState resets uncontrolled fields after every
  // submission. Controlled inputs preserve the user's repo and token
  // across error re-renders so they don't have to re-paste either.
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");

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
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
        />
        <p className="text-foreground-muted text-sm">
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
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="text-foreground-muted space-y-2 text-sm">
          <p>Stored encrypted at rest. Needs read + write on this repo.</p>
          <p>
            <strong className="text-foreground-weak font-medium">
              Don&apos;t have one yet?
            </strong>{" "}
            Create a fine-grained token at{" "}
            <a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground-weak hover:text-foreground underline underline-offset-2"
            >
              github.com/settings/personal-access-tokens/new
            </a>
            :
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <strong className="text-foreground-weak font-medium">
                Repository access
              </strong>{" "}
              → <em>Only select repositories</em> → pick this repo.
            </li>
            <li>
              <strong className="text-foreground-weak font-medium">
                Repository permissions
              </strong>{" "}
              →{" "}
              <code className="bg-surface rounded px-1 py-0.5 text-xs">
                Contents: Read and write
              </code>
              .
            </li>
            <li>Set an expiration that fits your org&apos;s policy, then generate.</li>
          </ol>
          <p>
            Classic tokens work too — use{" "}
            <a
              href="https://github.com/settings/tokens/new"
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground-weak hover:text-foreground underline underline-offset-2"
            >
              github.com/settings/tokens/new
            </a>{" "}
            with the{" "}
            <code className="bg-surface rounded px-1 py-0.5 text-xs">repo</code>{" "}
            scope.
          </p>
        </div>
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
