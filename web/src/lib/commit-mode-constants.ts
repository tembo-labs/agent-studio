// Client-safe commit-mode constants. Kept separate from `lib/workspace.ts`
// (which is server-only because it imports the Postgres pool) so the settings
// toggle + mode-aware buttons can render without dragging pg into the bundle.
//
// A workspace's commit mode decides how the Tembo Coding Agent's changes land:
//   - pull_request: the agent opens a PR for review (the default).
//   - direct ("YOLO"): the agent commits straight to the default branch.

export const COMMIT_MODES = ["pull_request", "direct"] as const;
export type CommitMode = (typeof COMMIT_MODES)[number];

export const COMMIT_MODE_LABELS: Record<CommitMode, string> = {
  pull_request: "Always PR",
  direct: "YOLO",
};

export function isCommitMode(v: string): v is CommitMode {
  return (COMMIT_MODES as readonly string[]).includes(v);
}
