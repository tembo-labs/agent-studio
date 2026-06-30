import type { ConnectionCategory } from "@/lib/connection-categories";

// One LibraryAgent per file in this directory (<id>.json), aggregated by the
// generated index.ts. Sourced from the "Agent Library" workbook: the base tab
// (work area, task, connections, scores) joined with the Composed Build Prompt
// tab (archetype + a copy-paste-ready prompt). Editing a starter = editing its
// JSON file.

export type LibraryAgent = {
  id: string;
  title: string;
  /** One-line "what it does" summary (shown on the card). */
  task: string;
  workArea: string;
  buildOrder: number;
  /** Build archetype, e.g. "Monitor & Alert", "Draft", "Knowledge Q&A". */
  archetype: string;
  categories: ConnectionCategory[];
  /** Browse labels: the archetype, plus "New idea" for newly-added agents. */
  labels: string[];
  firstWave: boolean;
  impact: number;
  resistance: number;
  score: number;
  sizeFit: string;
  verticalFit: string;
  /** Original spreadsheet Connection(s) phrasing, shown as a caption. */
  connectionSummary: string;
  notes?: string;
  /** Full, copy-paste-ready build prompt used to pre-fill the New Agent form. */
  prompt: string;
};
