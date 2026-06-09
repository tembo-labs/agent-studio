"use client";

import { useActionState, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogSkill } from "@/lib/skills-catalog";

import { installFromGitHubAction, type SkillActionState } from "./actions";

const INITIAL: SkillActionState = {};

// Browse + filter the curated skill catalog and install with one click. Each
// card posts the skill's owner/repo/path ref to the existing GitHub installer.
export function SkillsCatalogBrowser({
  workspaceSlug,
  catalog,
  installed,
}: {
  workspaceSlug: string;
  catalog: CatalogSkill[];
  installed: string[];
}) {
  const [query, setQuery] = useState("");
  const installedSet = useMemo(() => new Set(installed), [installed]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [catalog, query]);

  if (catalog.length === 0) {
    return (
      <p className="text-foreground-weak text-sm">
        Couldn&apos;t load the catalog right now. You can still install by slug
        below.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search skills…"
        className="max-w-sm"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {filtered.map((skill) => (
          <CatalogCard
            key={skill.ref}
            workspaceSlug={workspaceSlug}
            skill={skill}
            installed={installedSet.has(skill.name)}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-foreground-weak text-sm">No skills match “{query}”.</p>
      )}
    </div>
  );
}

function CatalogCard({
  workspaceSlug,
  skill,
  installed,
}: {
  workspaceSlug: string;
  skill: CatalogSkill;
  installed: boolean;
}) {
  const [state, action, pending] = useActionState(
    installFromGitHubAction,
    INITIAL,
  );
  const done = installed || !!state.message;

  return (
    <form
      action={action}
      className="border-border bg-surface-raised flex flex-col gap-2 rounded-lg border p-3"
    >
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="ref" value={skill.ref} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <code className="text-foreground text-sm font-medium">
            {skill.name}
          </code>
          <span className="text-foreground-muted text-xs uppercase tracking-wide">
            {skill.collection}
          </span>
        </div>
        <Button
          type="submit"
          size="small"
          variant={done ? "ghost" : "primary"}
          disabled={pending || done}
        >
          {pending ? "Installing…" : done ? "Installed ✓" : "Install"}
        </Button>
      </div>
      {skill.description && (
        <p className="text-foreground-weak line-clamp-3 text-sm">
          {skill.description}
        </p>
      )}
      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
      {!installed && state.message && (
        <Badge variant="green" size="small">
          Installed
        </Badge>
      )}
    </form>
  );
}
