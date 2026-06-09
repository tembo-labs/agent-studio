import "server-only";

import type { SkillFiles } from "@/lib/workspace-skills";

// Install a skill from the skills.sh directory, which (like `npx skills add`)
// resolves a slug to a GitHub-hosted folder: `<owner>/<repo>[/<path…>]`. We
// fetch that folder via the GitHub contents API and return skill-root-relative
// text files for installSkillFiles. A workspace github_pat (any public-repo-
// readable token) lifts the unauthenticated rate limit; it's optional.
//
// skills.sh has no confirmed public search API yet, so v1 installs by slug/URL.
// Catalog browsing can layer on once that API is verified.

const GH_API = "https://api.github.com";
const MAX_DEPTH = 5;
const MAX_TOTAL_BYTES = 1024 * 1024;

export type ParsedSkillRef = { owner: string; repo: string; path: string };

/**
 * Parse a skills.sh slug or GitHub URL into owner/repo/path.
 *   "browserbase/skills/browser"  → browserbase / skills / browser
 *   "vercel-labs/skills"          → vercel-labs / skills / ""
 *   "https://github.com/owner/repo/tree/main/skills/foo" → owner/repo/skills/foo
 */
export function parseSkillRef(input: string): ParsedSkillRef | null {
  let s = input.trim();
  if (!s) return null;

  // GitHub URL form.
  const urlMatch = s.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.*))?\/?$/,
  );
  if (urlMatch) {
    const [, owner, repo, path] = urlMatch;
    return { owner, repo: repo.replace(/\.git$/, ""), path: (path ?? "").replace(/\/$/, "") };
  }

  // Slug form: owner/repo[/path…]
  s = s.replace(/^\/+|\/+$/g, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo, ...rest] = parts;
  return { owner, repo, path: rest.join("/") };
}

type GhEntry = {
  type: string;
  name: string;
  path: string;
  size: number;
  download_url: string | null;
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

export type FetchSkillResult =
  | { ok: true; files: SkillFiles }
  | { ok: false; error: string };

/**
 * Fetch a skill folder from a public GitHub repo into skill-root-relative
 * text files (the folder at `ref.path` becomes the root, so its SKILL.md is
 * keyed "SKILL.md"). `token` is optional (public-repo read).
 */
export async function fetchSkillFromGitHub(
  ref: ParsedSkillRef,
  token?: string,
): Promise<FetchSkillResult> {
  const { owner, repo, path: root } = ref;
  const files: SkillFiles = {};
  let total = 0;

  async function walk(path: string, depth: number): Promise<string | null> {
    if (depth > MAX_DEPTH) return null;
    const url = `${GH_API}/repos/${owner}/${repo}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: ghHeaders(token), cache: "no-store" });
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    if (res.status === 404) return depth === 0 ? `"${owner}/${repo}/${path}" not found` : null;
    if (res.status === 403) return "GitHub rate-limited the request — add a GitHub token or try later.";
    if (!res.ok) return `GitHub returned ${res.status}`;

    const body = (await res.json()) as GhEntry | GhEntry[];
    const entries = Array.isArray(body) ? body : [body];
    for (const e of entries) {
      if (e.type === "dir") {
        const err = await walk(e.path, depth + 1);
        if (err) return err;
      } else if (e.type === "file" && e.download_url) {
        total += e.size;
        if (total > MAX_TOTAL_BYTES) return "Skill exceeds the 1 MB size limit.";
        let raw: Response;
        try {
          raw = await fetch(e.download_url, { cache: "no-store" });
        } catch (err) {
          return err instanceof Error ? err.message : String(err);
        }
        if (!raw.ok) return `Couldn't download ${e.path} (HTTP ${raw.status})`;
        // Strip the folder prefix so SKILL.md is keyed at the skill root.
        const rel = root ? e.path.slice(root.length + 1) : e.path;
        files[rel] = await raw.text();
      }
    }
    return null;
  }

  const err = await walk(root, 0);
  if (err) return { ok: false, error: err };
  if (!files["SKILL.md"]) {
    return { ok: false, error: "That folder has no SKILL.md — point at the skill's own directory." };
  }
  return { ok: true, files };
}
