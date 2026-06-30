"use client";

import { useActionState, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  KNOWLEDGE_WORK_SKILLS,
  KNOWLEDGE_WORK_DOMAINS,
  type KnowledgeWorkSkill,
} from "@/lib/knowledge-work-skills";

import { installFromGitHubAction, type SkillActionState } from "./actions";

// Browse anthropics/knowledge-work-plugins skills and install with one click.
// Each card just submits the skill's owner/repo/path `ref` to the existing
// installFromGitHubAction — no new server action.

const INITIAL: SkillActionState = {};

function domainLabel(slug: string): string {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function KnowledgeWorkSkillsBrowser({
  workspaceSlug,
  installed,
}: {
  workspaceSlug: string;
  /** Names of already-installed skills, to mark them. */
  installed: string[];
}) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const installedSet = useMemo(() => new Set(installed), [installed]);

  const domainOptions = useMemo(
    () => [
      { value: "", label: "All work areas" },
      ...KNOWLEDGE_WORK_DOMAINS.map((d) => ({ value: d, label: domainLabel(d) })),
    ],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return KNOWLEDGE_WORK_SKILLS.filter((s) => {
      if (domain && s.domain !== domain) return false;
      if (q && !`${s.name} ${s.description} ${s.domain}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [query, domain]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          placeholder="Search skills…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
          aria-label="Search knowledge-work skills"
        />
        <Select
          value={domain}
          onValueChange={setDomain}
          options={domainOptions}
          ariaLabel="Filter by work area"
          className="min-w-[170px]"
        />
        <span className="text-foreground-weak ml-auto text-sm">
          {filtered.length} skill{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((s) => (
          <SkillCard
            key={s.ref}
            skill={s}
            workspaceSlug={workspaceSlug}
            installed={installedSet.has(s.name)}
          />
        ))}
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  workspaceSlug,
  installed,
}: {
  skill: KnowledgeWorkSkill;
  workspaceSlug: string;
  installed: boolean;
}) {
  const [state, action, pending] = useActionState(installFromGitHubAction, INITIAL);
  return (
    <form
      action={action}
      className="border-border bg-surface-secondary flex flex-col gap-2 rounded-lg border p-4"
    >
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="ref" value={skill.ref} />
      <div className="flex items-start justify-between gap-2">
        <span className="text-foreground font-medium">{skill.name}</span>
        <Badge variant="gray" size="small">
          {domainLabel(skill.domain)}
        </Badge>
      </div>
      <p className="text-foreground-weak flex-1 text-sm leading-snug">
        {skill.description}
      </p>
      <div className="flex items-center gap-3 pt-1">
        {installed ? (
          <Badge variant="green" size="small">
            Installed
          </Badge>
        ) : (
          <Button type="submit" size="small" variant="secondary" disabled={pending}>
            {pending ? "Installing…" : "Install"}
          </Button>
        )}
        {state.error && (
          <span className="text-sentiment-negative text-sm">{state.error}</span>
        )}
        {state.message && (
          <span className="text-sentiment-positive text-sm">{state.message}</span>
        )}
      </div>
    </form>
  );
}
