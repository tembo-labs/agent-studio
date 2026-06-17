"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  importFromAnthropicAction,
  installFromGitHubAction,
  removeSkillAction,
  uploadSkillAction,
  type SkillActionState,
} from "./actions";

const INITIAL: SkillActionState = {};

function Result({ state }: { state: SkillActionState }) {
  if (state.error) {
    return (
      <p className="text-sentiment-negative text-sm" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p className="text-sentiment-positive text-sm" role="status">
        {state.message}
      </p>
    );
  }
  return null;
}

export function AddFromGitHubForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, action, pending] = useActionState(installFromGitHubAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <Label htmlFor="skill-ref" className="text-sm">
        skills.sh slug or GitHub folder
      </Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="skill-ref"
          name="ref"
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
          placeholder="vercel-labs/skills/find-skills"
          className="min-w-64 flex-1"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Installing…" : "Install"}
        </Button>
      </div>
      <p className="text-foreground-muted text-sm">
        Browse the directory at{" "}
        <a
          href="https://www.skills.sh/"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
        >
          skills.sh
        </a>
        , then paste a skill&apos;s <code>owner/repo/path</code> or its GitHub URL.
      </p>
      <Result state={state} />
    </form>
  );
}

export function UploadSkillForm({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, action, pending] = useActionState(uploadSkillAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <Label htmlFor="skill-bundle" className="text-sm">
        Skill bundle (.zip containing SKILL.md)
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="skill-bundle"
          name="bundle"
          type="file"
          accept=".zip,application/zip"
          disabled={pending}
          className="text-foreground-weak text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-secondary file:px-3 file:py-1.5 file:text-sm file:text-foreground"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

export type ImportableSkill = {
  id: string;
  displayTitle: string;
  source: "anthropic" | "custom";
};

export function ImportFromClaudeForm({
  workspaceSlug,
  skills,
  error,
}: {
  workspaceSlug: string;
  skills: ImportableSkill[];
  error: string | null;
}) {
  const [state, action, pending] = useActionState(importFromAnthropicAction, INITIAL);

  if (error) {
    return <p className="text-foreground-weak text-sm">{error}</p>;
  }
  if (skills.length === 0) {
    return (
      <p className="text-foreground-weak text-sm">
        No skills found for this workspace&apos;s Anthropic key. Create skills via
        the Claude Skills API, then import them here.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <Label htmlFor="skill-id" className="text-sm">
        Skill
      </Label>
      <div className="flex flex-wrap gap-2">
        <select
          id="skill-id"
          name="skillId"
          disabled={pending}
          className="bg-surface border-border text-foreground min-w-64 flex-1 rounded-md border px-3 py-2 text-sm"
        >
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayTitle} ({s.source})
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function RemoveSkillForm({
  workspaceSlug,
  name,
}: {
  workspaceSlug: string;
  name: string;
}) {
  const [state, action, pending] = useActionState(removeSkillAction, INITIAL);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="name" value={name} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Removing…" : "Remove"}
      </Button>
      {state.error && (
        <span className="text-sentiment-negative text-sm">{state.error}</span>
      )}
    </form>
  );
}
