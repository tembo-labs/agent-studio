import "server-only";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import YAML from "yaml";

import type { LibraryAgent } from "./types";

export type { LibraryAgent } from "./types";

// The agent library is a directory of <id>.yaml files (one per starter). We
// read + parse them at runtime, memoized for the process. process.cwd() is
// `web/` in dev and `/app/` in the standalone container; next.config.ts's
// outputFileTracingIncludes ships the .yaml files at the matching relative
// path in both. Mirrors the repo-readme template read in repo-init.ts.
const DIR_REL = "src/lib/agent-library";

let cache: LibraryAgent[] | null = null;

export async function loadAgentLibrary(): Promise<LibraryAgent[]> {
  if (cache) return cache;
  const dir = join(process.cwd(), DIR_REL);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".yaml"));
  const agents = await Promise.all(
    files.map(
      async (f) =>
        YAML.parse(await readFile(join(dir, f), "utf8")) as LibraryAgent,
    ),
  );
  // Stable catalog order (work area, then build order) so equal-rank ties in
  // the gallery render predictably.
  agents.sort(
    (a, b) => a.workArea.localeCompare(b.workArea) || a.buildOrder - b.buildOrder,
  );
  cache = agents;
  return agents;
}

export async function getLibraryAgent(
  id: string,
): Promise<LibraryAgent | undefined> {
  return (await loadAgentLibrary()).find((a) => a.id === id);
}
