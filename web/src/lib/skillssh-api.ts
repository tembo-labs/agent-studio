import "server-only";

import type { SkillFiles } from "@/lib/workspace-skills";

// Live skills.sh directory, via its public (unauthenticated) API — the same
// endpoints the Tembo monorepo proxies. The newer /api/v1 surface requires a
// Vercel OIDC token; these legacy /api/* endpoints are open, so they work from
// a self-hosted instance with no Vercel dependency.
//
// Risk: these are undocumented legacy endpoints; if skills.sh retires them in
// favor of the OIDC-gated v1 API, the catalog browse breaks (install-by-URL +
// upload + Claude import still work). Cheap to re-point if that happens.

const BASE = "https://skills.sh/api";

export type SkillsShEntry = {
  /** "owner/repo" the skill lives in. */
  source: string;
  /** Skill folder name within the source. */
  skillId: string;
  name: string;
  installs: number;
};

type RawEntry = {
  source?: string;
  skillId?: string;
  name?: string;
  installs?: number;
};

function normalize(rows: RawEntry[]): SkillsShEntry[] {
  return rows
    .filter((r) => r.source && r.skillId && r.name)
    .map((r) => ({
      source: r.source!,
      skillId: r.skillId!,
      name: r.name!,
      installs: typeof r.installs === "number" ? r.installs : 0,
    }));
}

export type SkillsShListResult =
  | { ok: true; skills: SkillsShEntry[] }
  | { ok: false; error: string };

/** Most-installed skills (the directory's default browse). Cached briefly. */
export async function popularSkillsSh(limit = 24): Promise<SkillsShListResult> {
  try {
    const res = await fetch(`${BASE}/skills/all-time/1`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return { ok: false, error: `skills.sh returned ${res.status}` };
    const json = (await res.json()) as { skills?: RawEntry[] };
    return { ok: true, skills: normalize(json.skills ?? []).slice(0, limit) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Search the directory by name / source / description. */
export async function searchSkillsSh(
  query: string,
  limit = 24,
): Promise<SkillsShListResult> {
  const q = query.trim();
  if (q.length < 2) return { ok: true, skills: [] };
  try {
    const res = await fetch(
      `${BASE}/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { ok: false, error: `skills.sh returned ${res.status}` };
    const json = (await res.json()) as { skills?: RawEntry[] };
    return { ok: true, skills: normalize(json.skills ?? []) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type DownloadSkillResult =
  | { ok: true; files: SkillFiles }
  | { ok: false; error: string };

/**
 * Download a skill's files from skills.sh. `source` is "owner/repo"; the API
 * returns `{ files: [{ path, contents }] }` already keyed skill-root-relative.
 */
export async function downloadSkillSh(
  source: string,
  skillId: string,
): Promise<DownloadSkillResult> {
  const parts = source.split("/").filter(Boolean);
  if (parts.length < 2) {
    return { ok: false, error: `Unexpected skill source "${source}".` };
  }
  const [owner, repo] = parts;
  const url = `${BASE}/download/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(skillId)}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!res.ok) return { ok: false, error: `Download failed (HTTP ${res.status}).` };

  const json = (await res.json()) as {
    files?: Array<{ path?: string; contents?: string }> | null;
  };
  if (!json.files || json.files.length === 0) {
    return { ok: false, error: "skills.sh returned no files for that skill." };
  }
  const files: SkillFiles = {};
  for (const f of json.files) {
    if (typeof f.path === "string" && typeof f.contents === "string") {
      files[f.path.replace(/^(\.\/)+/, "")] = f.contents;
    }
  }
  if (!files["SKILL.md"]) {
    return { ok: false, error: "Downloaded bundle has no SKILL.md." };
  }
  return { ok: true, files };
}
