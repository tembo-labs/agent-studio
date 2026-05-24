import "server-only";
import YAML from "yaml";

import type { Framework } from "@/lib/agent-framework";

// Pydantic AI AgentSpec — minimum shape we require for v0.1. The full spec
// is broader (capabilities, output_schema, deps_schema, model_settings,
// instrument, …); we deliberately validate only the load-bearing fields so
// custom extensions pass through. See context/0.1/AGENT_FORMAT.md.

// Re-export so callers that import from agent-format keep working.
export { FRAMEWORKS, FRAMEWORK_LABELS } from "@/lib/agent-framework";
export type { Framework } from "@/lib/agent-framework";

export type AgentSpec = {
  name: string;
  framework: Framework;
  model: string;
  instructions: string;
  description?: string;
  /** Raw parsed object preserved for round-tripping. */
  raw: Record<string, unknown>;
};

export type AgentFileFormat = "yaml" | "json";

export type ParseAgentError =
  | "unsupported-extension"
  | "invalid-yaml"
  | "invalid-json"
  | "not-an-object"
  | "missing-name"
  | "missing-model"
  | "missing-instructions"
  | "invalid-name";

export type ParseAgentResult =
  | { ok: true; spec: AgentSpec; format: AgentFileFormat }
  | { ok: false; error: ParseAgentError; detail?: string };

export function detectFormat(filename: string): AgentFileFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".json")) return "json";
  return null;
}

/** Same charset as workspace slugs — the filename will be `{name}.{ext}`. */
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateAgentName(name: string): boolean {
  return name.length >= 2 && name.length <= 64 && NAME_RE.test(name);
}

export function parseAgentContent(
  content: string,
  format: AgentFileFormat,
): ParseAgentResult {
  let parsed: unknown;
  try {
    parsed = format === "yaml" ? YAML.parse(content) : JSON.parse(content);
  } catch (err) {
    return {
      ok: false,
      error: format === "yaml" ? "invalid-yaml" : "invalid-json",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "not-an-object" };
  }

  const obj = parsed as Record<string, unknown>;

  const name = obj.name;
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "missing-name" };
  }
  if (!validateAgentName(name)) {
    return {
      ok: false,
      error: "invalid-name",
      detail:
        "Agent name must be 2–64 chars, lowercase letters, digits, and hyphens.",
    };
  }

  const model = obj.model;
  if (typeof model !== "string" || !model.trim()) {
    return { ok: false, error: "missing-model" };
  }
  const instructions = obj.instructions;
  if (typeof instructions !== "string" || !instructions.trim()) {
    return { ok: false, error: "missing-instructions" };
  }

  const description =
    typeof obj.description === "string" ? obj.description : undefined;

  // Framework is computed from the parsed shape. Today only Pydantic
  // AgentSpec is supported, so this is constant; when the Cargo AI parser
  // lands (US-0.1-05 follow-up), this dispatch grows a branch.
  const framework: Framework = "pydantic-agentspec";

  return {
    ok: true,
    format,
    spec: { name, framework, model, instructions, description, raw: obj },
  };
}

export function parseAgentFile(
  filename: string,
  content: string,
): ParseAgentResult {
  const format = detectFormat(filename);
  if (!format) {
    return { ok: false, error: "unsupported-extension" };
  }
  return parseAgentContent(content, format);
}

// The starter template ships with a default model so the "from template"
// path stays a one-field form (name only). Per the v0.1 README open
// question, this is the agreed default; per-workspace defaults can land
// later if a customer asks.
export const STARTER_DEFAULT_MODEL = "anthropic:claude-sonnet-4-6";

export function renderStarter(name: string): string {
  return `# Pydantic AI AgentSpec — see context/0.1/AGENT_FORMAT.md
name: ${name}
model: ${STARTER_DEFAULT_MODEL}
description: Sample agent generated from the v0.1 starter template.
instructions: |
  You are a friendly agent.
  Greet the user warmly and answer briefly.
model_settings:
  max_tokens: 512
`;
}
