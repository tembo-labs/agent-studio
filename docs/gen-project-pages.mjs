// Generate the Changelog + Roadmap doc pages from the canonical root files
// (CHANGELOG.md / ROADMAP.md) so the published site stays in sync with them.
// Runs as the docs `prebuild`; the in-app docs viewer reads the root files
// directly, so this only serves the public Starlight site. Re-run after editing
// CHANGELOG.md / ROADMAP.md: `node gen-project-pages.mjs`.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const OUT = join(here, "src/content/docs");

const pages = [
  {
    slug: "changelog",
    file: "CHANGELOG.md",
    title: "Changelog",
    description: "Every notable change to Tembo Agent Studio, by release.",
  },
  {
    slug: "roadmap",
    file: "ROADMAP.md",
    title: "Roadmap",
    description: "Where Tembo Agent Studio is headed.",
  },
];

for (const p of pages) {
  const raw = readFileSync(join(ROOT, p.file), "utf8");
  // Drop the leading "# Title" — Starlight renders its own page title.
  const m = raw.match(/^\s*#\s+.+\n([\s\S]*)$/);
  const body = (m ? m[1] : raw).trim();
  const frontmatter = `---\ntitle: ${p.title}\ndescription: ${p.description}\n---\n\n`;
  writeFileSync(join(OUT, `${p.slug}.md`), `${frontmatter}${body}\n`);
  console.log(`gen-project-pages: wrote ${p.slug}.md`);
}
