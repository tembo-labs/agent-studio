import "server-only";
import YAML from "yaml";

import type { Framework } from "@/lib/agent-framework";

// Two agent frameworks ship in v0.1: Pydantic AI's AgentSpec (canonical
// authoring format) and Cargo AI's single-file JSON (importable). The
// parser dispatches on shape — see detectFramework below — and returns
// a discriminated union so the type system can tell consumers which
// fields are guaranteed for each framework. See context/0.1/AGENT_FORMAT.md.

// Re-export so callers that import from agent-format keep working.
export { FRAMEWORKS, FRAMEWORK_LABELS } from "@/lib/agent-framework";
export type { Framework } from "@/lib/agent-framework";

type AgentSpecBase = {
  name: string;
  description?: string;
  /** Raw parsed object preserved for round-tripping. */
  raw: Record<string, unknown>;
};

export type PydanticAgentSpec = AgentSpecBase & {
  framework: "pydantic-agentspec";
  model: string;
  instructions: string;
};

export type CargoAiSpec = AgentSpecBase & {
  framework: "cargo-ai";
  /** Cargo AI agents don't always expose a top-level `model` field. */
  model: string | null;
};

export type AgentSpec = PydanticAgentSpec | CargoAiSpec;

export type AgentFileFormat = "yaml" | "json";

export type ParseAgentError =
  | "unsupported-extension"
  | "invalid-yaml"
  | "invalid-json"
  | "not-an-object"
  | "unrecognized-shape"
  | "missing-name"
  | "missing-model"
  | "missing-instructions"
  | "missing-actions"
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

/**
 * Dispatch on the parsed object's shape:
 *  - `instructions: string` → Pydantic AgentSpec
 *  - `actions: array`       → Cargo AI
 *  - otherwise              → unrecognized
 *
 * If a file happens to have both (someone wrote a hybrid), we prefer
 * Pydantic AgentSpec because that's our canonical authoring format.
 */
function detectFramework(obj: Record<string, unknown>): Framework | null {
  const hasInstructions =
    typeof obj.instructions === "string" && obj.instructions.trim() !== "";
  if (hasInstructions) return "pydantic-agentspec";
  const hasActions = Array.isArray(obj.actions);
  if (hasActions) return "cargo-ai";
  return null;
}

function parsePydanticSpec(
  obj: Record<string, unknown>,
  base: AgentSpecBase,
): ParseAgentResult | { spec: PydanticAgentSpec } {
  const model = obj.model;
  if (typeof model !== "string" || !model.trim()) {
    return { ok: false, error: "missing-model" };
  }
  const instructions = obj.instructions;
  if (typeof instructions !== "string" || !instructions.trim()) {
    return { ok: false, error: "missing-instructions" };
  }
  return {
    spec: { ...base, framework: "pydantic-agentspec", model, instructions },
  };
}

function parseCargoAiSpec(
  obj: Record<string, unknown>,
  base: AgentSpecBase,
): ParseAgentResult | { spec: CargoAiSpec } {
  if (!Array.isArray(obj.actions)) {
    return { ok: false, error: "missing-actions" };
  }
  // Cargo AI's model placement varies (top-level vs `runtime_vars.model`);
  // we accept either flat shape, with null as the honest "didn't find one"
  // value so the UI renders "—" rather than guessing.
  let model: string | null = null;
  if (typeof obj.model === "string" && obj.model.trim()) {
    model = obj.model;
  } else if (
    obj.runtime_vars &&
    typeof obj.runtime_vars === "object" &&
    !Array.isArray(obj.runtime_vars)
  ) {
    const m = (obj.runtime_vars as Record<string, unknown>).model;
    if (typeof m === "string" && m.trim()) model = m;
  }

  return { spec: { ...base, framework: "cargo-ai", model } };
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

  const description =
    typeof obj.description === "string" ? obj.description : undefined;
  const base: AgentSpecBase = { name, description, raw: obj };

  const framework = detectFramework(obj);
  if (framework === null) {
    return {
      ok: false,
      error: "unrecognized-shape",
      detail:
        "Not a recognized agent format. Pydantic AgentSpec needs `instructions`; Cargo AI needs an `actions` array.",
    };
  }

  if (framework === "pydantic-agentspec") {
    const result = parsePydanticSpec(obj, base);
    if ("ok" in result) return result;
    return { ok: true, format, spec: result.spec };
  }

  // framework === 'cargo-ai'
  const result = parseCargoAiSpec(obj, base);
  if ("ok" in result) return result;
  return { ok: true, format, spec: result.spec };
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

// ── Cargo AI runtime extraction ────────────────────────────────────────
//
// The Rust runner takes a single (model, instructions, user_message)
// tuple and calls the provider once. To make Cargo AI agents runnable
// without building a full action-graph interpreter, the web layer
// flattens a Cargo AI spec down to that shape:
//   model         ← runtime_vars.model (or top-level `model`)
//   instructions  ← concatenated prompts of every `type: "llm"` action
//
// This is intentionally a v0.1 simplification — JSON Logic branching,
// non-llm action types, agent_schema validation, and multi-step run
// orchestration all stay deferred to a richer Cargo AI runtime that
// can land alongside the v0.3+ multi-framework slice.

export type CargoAiRunnable = {
  model: string;
  instructions: string;
};

export type CargoAiRunnableError = "missing-model" | "no-llm-actions";

export function extractCargoAiRunnable(
  spec: CargoAiSpec,
):
  | { ok: true; runnable: CargoAiRunnable }
  | { ok: false; error: CargoAiRunnableError } {
  if (!spec.model) return { ok: false, error: "missing-model" };

  const actions = spec.raw.actions;
  if (!Array.isArray(actions)) return { ok: false, error: "no-llm-actions" };

  const prompts: string[] = [];
  for (const a of actions) {
    if (
      a &&
      typeof a === "object" &&
      !Array.isArray(a) &&
      (a as Record<string, unknown>).type === "llm" &&
      typeof (a as Record<string, unknown>).prompt === "string"
    ) {
      prompts.push((a as Record<string, unknown>).prompt as string);
    }
  }
  if (prompts.length === 0) return { ok: false, error: "no-llm-actions" };

  return {
    ok: true,
    runnable: { model: spec.model, instructions: prompts.join("\n\n") },
  };
}

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

export function renderCargoStarter(name: string): string {
  // Minimal-but-real Cargo AI JSON: parses cleanly under the v0.1
  // parser (has `agent_schema` and `actions`), is runnable via the
  // simplified Cargo runner (has runtime_vars.model + one llm action),
  // and reads as something a customer would actually keep as a base.
  const obj = {
    name,
    description: "Sample agent generated from the v0.1 starter template.",
    agent_schema: {
      type: "object",
      properties: {
        reply: {
          type: "string",
          description: "The agent's response.",
        },
      },
      required: ["reply"],
    },
    runtime_vars: {
      model: STARTER_DEFAULT_MODEL,
    },
    actions: [
      {
        id: "respond",
        type: "llm",
        prompt: "You are a friendly agent. Greet the user warmly and answer briefly.",
      },
    ],
  };
  return `${JSON.stringify(obj, null, 2)}\n`;
}
