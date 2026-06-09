import "server-only";

import { unzipSkillBundle } from "@/lib/skill-bundle";
import type { SkillFiles } from "@/lib/workspace-skills";

// Read + export skills from the Claude Skills API (beta) with the workspace's
// Anthropic key. List shows both Anthropic pre-built (pptx/xlsx/docx/pdf) and
// the org's custom skills; export downloads a version's zip so we can commit it
// into the repo. Beta: skills-2025-10-02.

const ANTHROPIC_BASE = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
const SKILLS_BETA = "skills-2025-10-02";

function headers(apiKey: string): Record<string, string> {
  return {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": SKILLS_BETA,
  };
}

export type AnthropicSkill = {
  id: string;
  displayTitle: string;
  source: "anthropic" | "custom";
  latestVersion: string;
};

type ListRow = {
  id: string;
  display_title: string;
  source: "anthropic" | "custom";
  latest_version: string;
};

export type ListSkillsResult =
  | { ok: true; skills: AnthropicSkill[] }
  | { ok: false; error: string };

/** GET /v1/skills (paginated). Returns Anthropic + custom skills. */
export async function listAnthropicSkills(
  apiKey: string,
): Promise<ListSkillsResult> {
  const skills: AnthropicSkill[] = [];
  let page: string | null = null;
  // Bound the loop; an org won't have hundreds of skills, and each page is 100.
  for (let i = 0; i < 20; i++) {
    const url = new URL(`${ANTHROPIC_BASE}/v1/skills`);
    url.searchParams.set("limit", "100");
    if (page) url.searchParams.set("page", page);

    let res: Response;
    try {
      res = await fetch(url, { headers: headers(apiKey), cache: "no-store" });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Anthropic rejected the API key (check Settings → LLM Providers)." };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Anthropic returned ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}` };
    }
    const json = (await res.json()) as {
      data: ListRow[];
      has_more: boolean;
      next_page: string | null;
    };
    for (const r of json.data) {
      skills.push({
        id: r.id,
        displayTitle: r.display_title,
        source: r.source,
        latestVersion: r.latest_version,
      });
    }
    if (!json.has_more || !json.next_page) break;
    page = json.next_page;
  }
  skills.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
  return { ok: true, skills };
}

export type ExportSkillResult =
  | { ok: true; files: SkillFiles; skipped: string[] }
  | { ok: false; error: string };

/**
 * Download a skill version's content (a zip) and unpack it to skill-root-
 * relative text files. `version` defaults to the skill's latest.
 */
export async function exportAnthropicSkill(
  apiKey: string,
  skillId: string,
  version = "latest",
): Promise<ExportSkillResult> {
  // Resolve "latest" → the concrete version id the content endpoint wants.
  let ver = version;
  if (ver === "latest") {
    let res: Response;
    try {
      res = await fetch(`${ANTHROPIC_BASE}/v1/skills/${skillId}`, {
        headers: headers(apiKey),
        cache: "no-store",
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (!res.ok) {
      return { ok: false, error: `Couldn't resolve skill ${skillId} (HTTP ${res.status}).` };
    }
    const json = (await res.json()) as { latest_version: string };
    ver = json.latest_version;
  }

  let res: Response;
  try {
    res = await fetch(
      `${ANTHROPIC_BASE}/v1/skills/${skillId}/versions/${ver}/content`,
      { headers: headers(apiKey), cache: "no-store" },
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Download failed (HTTP ${res.status})${body ? `: ${body.slice(0, 200)}` : ""}` };
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  return unzipSkillBundle(buf);
}
