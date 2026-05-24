// Client-safe constants for the harness field. Kept separate from
// `agent-format.ts` (which is server-only because it imports the YAML
// parser path) so the new-agent form can render the harness dropdown.

export const HARNESSES = ["claude-code", "opencode", "pi"] as const;
export type Harness = (typeof HARNESSES)[number];

export const HARNESS_LABELS: Record<Harness, string> = {
  "claude-code": "Claude Code",
  opencode: "OpenCode",
  pi: "Pi",
};
