"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SkillsShEntry } from "@/lib/skillssh-api";

import {
  installFromSkillsShAction,
  searchSkillsShAction,
  type SkillActionState,
} from "./actions";

const INITIAL: SkillActionState = {};

// Browse the live skills.sh directory: popular skills by default, live search as
// you type, one-click install (downloads the skill's files + commits them).
export function SkillsCatalogBrowser({
  workspaceSlug,
  popular,
  installed,
}: {
  workspaceSlug: string;
  popular: SkillsShEntry[];
  installed: string[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SkillsShEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const installedSet = useMemo(() => new Set(installed), [installed]);

  const isSearching = query.trim().length >= 2;
  const shown = isSearching ? results : popular;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      startSearch(async () => {
        const r = await searchSkillsShAction(workspaceSlug, q);
        if (r.ok) {
          setResults(r.skills);
          setError(null);
        } else {
          setError(r.error);
        }
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query, workspaceSlug]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the skills.sh directory…"
        className="max-w-sm"
      />
      {error && (
        <p className="text-sentiment-negative text-sm">
          Couldn&apos;t reach skills.sh: {error}
        </p>
      )}
      {!error && popular.length === 0 && !isSearching && (
        <p className="text-foreground-weak text-sm">
          Couldn&apos;t load the directory right now. You can still install by
          slug below.
        </p>
      )}
      <p className="text-foreground-muted text-xs uppercase tracking-wide">
        {isSearching
          ? searching
            ? "Searching…"
            : `${shown.length} result${shown.length === 1 ? "" : "s"}`
          : "Popular"}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {shown.map((skill) => (
          <CatalogCard
            key={`${skill.source}/${skill.skillId}`}
            workspaceSlug={workspaceSlug}
            skill={skill}
            installed={installedSet.has(skill.name)}
          />
        ))}
      </div>
      {isSearching && !searching && shown.length === 0 && !error && (
        <p className="text-foreground-weak text-sm">No skills match “{query}”.</p>
      )}
    </div>
  );
}

function formatInstalls(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
  return String(n);
}

function CatalogCard({
  workspaceSlug,
  skill,
  installed,
}: {
  workspaceSlug: string;
  skill: SkillsShEntry;
  installed: boolean;
}) {
  const [state, action, pending] = useActionState(
    installFromSkillsShAction,
    INITIAL,
  );
  const done = installed || !!state.message;

  return (
    <form
      action={action}
      className="border-border bg-surface-raised flex flex-col gap-2 rounded-lg border p-3"
    >
      <input type="hidden" name="workspace" value={workspaceSlug} />
      <input type="hidden" name="source" value={skill.source} />
      <input type="hidden" name="skillId" value={skill.skillId} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <code className="text-foreground truncate text-sm font-medium">
            {skill.name}
          </code>
          <span className="text-foreground-muted truncate text-xs">
            <a
              href={`https://skills.sh/${skill.source}/${skill.skillId}`}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-foreground underline underline-offset-2"
              title="Read more on skills.sh"
            >
              {skill.source}
            </a>{" "}
            · {formatInstalls(skill.installs)} installs
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
      {state.error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
