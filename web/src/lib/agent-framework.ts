// Client-safe constants for the agent framework. Kept separate from
// `agent-format.ts` (which is server-only because it imports the YAML
// parser path) so client components can render the framework badge.
//
// Each framework is a distinct "what kind of agent is this" answer:
//   - `pydantic-agentspec` — Pydantic AI's single-file AgentSpec format.
//     The v0.1 canonical authoring format.
//   - `cargo-ai` — Cargo AI single-file JSON format. Importable in v0.1
//     (parser lands as a follow-up to slice 4); see context/shipped/0.1/AGENT_FORMAT.md.
//
// The v0.3+ direction (see context/shipped/0.3/README.md) expands this enum to
// include LangGraph, OpenAI Agents SDK, Mastra, CrewAI, and Pydantic AI
// code mode as first-class supported runtimes.
//
// Harness (Claude Code / OpenCode / Pi as the runtime driving a coding-
// agent flow) is a *different* concept and is intentionally deferred until
// raw-coding-agent flows are first-class — likely v0.3+.

//   - `eve` — Vercel's Eve framework. Unlike the other two, an Eve agent is a
//     *directory* of TypeScript files (agent/agent.ts, tools/, …), not a single
//     spec file. TAS runs it one-shot in-process via the Node harness (see
//     api/scripts/run_eve.mjs); the model is configured in agent.ts with a
//     direct @ai-sdk provider.

export const FRAMEWORKS = ["pydantic-agentspec", "cargo-ai", "eve"] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  "pydantic-agentspec": "Pydantic",
  "cargo-ai": "Cargo AI",
  eve: "Eve",
};
