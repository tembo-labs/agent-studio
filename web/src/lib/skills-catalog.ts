import "server-only";

import { parseSkillFrontmatter } from "@/lib/workspace-skills";

// A browsable catalog of installable skills, sourced from public GitHub skill
// collections (so we don't depend on skills.sh's Vercel-OIDC-gated API). Each
// entry resolves to an `owner/repo/path` the existing GitHub installer accepts.
// Listing is cached an hour — the catalog changes rarely.

type CatalogSource = {
  /** Label shown on the card (the collection). */
  collection: string;
  owner: string;
  repo: string;
  /** Directory under the repo that holds skill subfolders. */
  path: string;
  ref: string;
};

// Curated collections. Anthropic's official set first; add more over time.
const CATALOG_SOURCES: CatalogSource[] = [
  {
    collection: "Anthropic",
    owner: "anthropics",
    repo: "skills",
    path: "skills",
    ref: "main",
  },
];

const CATALOG_TTL_SECONDS = 3600;

export type CatalogSkill = {
  collection: string;
  /** Skill folder name (what it installs as). */
  name: string;
  description: string | null;
  /** `owner/repo/path` for the installer. */
  ref: string;
};

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "tembo-agent-studio",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/**
 * The catalog: each collection's skill folders + their SKILL.md description.
 * `token` (a public-repo-readable GitHub PAT) lifts the rate limit. Best-effort
 * — a failing collection is skipped rather than erroring the page.
 */
export async function listCatalogSkills(token?: string): Promise<CatalogSkill[]> {
  const all: CatalogSkill[] = [];
  for (const src of CATALOG_SOURCES) {
    const listUrl = `https://api.github.com/repos/${src.owner}/${src.repo}/contents/${src.path}?ref=${src.ref}`;
    let res: Response;
    try {
      res = await fetch(listUrl, {
        headers: ghHeaders(token),
        next: { revalidate: CATALOG_TTL_SECONDS },
      });
    } catch {
      continue;
    }
    if (!res.ok) continue;
    const entries = (await res.json()) as Array<{ type: string; name: string }>;
    if (!Array.isArray(entries)) continue;

    const dirs = entries.filter((e) => e.type === "dir");
    const skills = await Promise.all(
      dirs.map(async (d): Promise<CatalogSkill> => {
        const rawUrl = `https://raw.githubusercontent.com/${src.owner}/${src.repo}/${src.ref}/${src.path}/${d.name}/SKILL.md`;
        let description: string | null = null;
        try {
          const r = await fetch(rawUrl, {
            next: { revalidate: CATALOG_TTL_SECONDS },
          });
          if (r.ok) description = parseSkillFrontmatter(await r.text()).description;
        } catch {
          // leave description null
        }
        return {
          collection: src.collection,
          name: d.name,
          description,
          ref: `${src.owner}/${src.repo}/${src.path}/${d.name}`,
        };
      }),
    );
    all.push(...skills);
  }
  all.sort((a, b) => a.name.localeCompare(b.name));
  return all;
}
