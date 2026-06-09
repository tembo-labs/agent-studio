import "server-only";
import { unzipSync } from "fflate";

import type { SkillFiles } from "@/lib/workspace-skills";

// Turn a skill .zip (Claude API export, or a custom upload) into skill-root-
// relative text files for installSkillFiles. Strips a common top-level
// directory so SKILL.md lands at the root. Skills are text (SKILL.md, scripts,
// references); a non-UTF-8 (binary) entry is dropped with a note rather than
// corrupting it.

export type UnzipResult =
  | { ok: true; files: SkillFiles; skipped: string[] }
  | { ok: false; error: string };

const MAX_ENTRY_BYTES = 512 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });

export function unzipSkillBundle(bytes: Uint8Array): UnzipResult {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (e) {
    return { ok: false, error: `Not a valid zip: ${e instanceof Error ? e.message : String(e)}` };
  }

  // Keep only files (zip dir entries end in "/" and have empty data).
  const paths = Object.keys(entries).filter((p) => !p.endsWith("/"));
  if (paths.length === 0) return { ok: false, error: "Zip is empty." };

  const stripped = stripCommonTopDir(paths);

  const files: SkillFiles = {};
  const skipped: string[] = [];
  for (const orig of paths) {
    const rel = stripped.get(orig)!;
    const data = entries[orig];
    if (data.length > MAX_ENTRY_BYTES) {
      skipped.push(`${rel} (too large)`);
      continue;
    }
    let text: string;
    try {
      text = decoder.decode(data);
    } catch {
      skipped.push(`${rel} (binary)`);
      continue;
    }
    files[rel] = text;
  }

  if (!files["SKILL.md"]) {
    return { ok: false, error: "Bundle has no SKILL.md at its root." };
  }
  return { ok: true, files, skipped };
}

/** If every path shares a single leading directory, drop it. */
function stripCommonTopDir(paths: string[]): Map<string, string> {
  const firstSegs = new Set(paths.map((p) => p.split("/")[0]));
  const hasCommonTop =
    firstSegs.size === 1 && paths.every((p) => p.includes("/"));
  const out = new Map<string, string>();
  for (const p of paths) {
    out.set(p, hasCommonTop ? p.slice(p.indexOf("/") + 1) : p);
  }
  return out;
}
