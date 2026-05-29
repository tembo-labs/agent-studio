import "server-only";
import YAML from "yaml";

import type { Framework } from "@/lib/agent-framework";

// Two agent frameworks ship in v0.1: Pydantic AI's AgentSpec (canonical
// authoring format) and Cargo AI's single-file JSON (importable). The
// parser dispatches on shape — see detectFramework below — and returns
// a discriminated union so the type system can tell consumers which
// fields are guaranteed for each framework. See context/shipped/0.1/AGENT_FORMAT.md.

// Re-export so callers that import from agent-format keep working.
export { FRAMEWORKS, FRAMEWORK_LABELS } from "@/lib/agent-framework";
export type { Framework } from "@/lib/agent-framework";

type AgentSpecBase = {
  name: string;
  description?: string;
  /** Raw parsed object preserved for round-tripping. */
  raw: Record<string, unknown>;
};

export type AgentConnectionSource = "composio" | "native-mcp";

export type AgentConnection = {
  /** Provider slug. For source="composio" this is a Composio toolkit
   *  slug ("gmail", "slack"); for source="native-mcp" it's a slug
   *  from lib/mcp-providers ("attio"). */
  toolkit: string;
  /**
   * Named connection slot — disambiguates when a user has multiple
   * accounts of the same toolkit (e.g. "work" vs "personal" Gmail).
   * Defaults to "default" when the spec uses the loose `- gmail`
   * form.
   */
  name: string;
  /**
   * Which connection mode the runner should use for this entry.
   * Defaults to "composio" so existing specs need no edit. Set
   * "native-mcp" to talk directly to the provider's official MCP
   * server with TAS-managed OAuth (the workspace_connection row
   * the user authorized under Connections).
   */
  source: AgentConnectionSource;
};

export type PydanticAgentSpec = AgentSpecBase & {
  framework: "pydantic-agentspec";
  model: string;
  instructions: string;
  /**
   * External services this agent depends on at run time. Each entry
   * resolves at run time to a Composio connection owned by the user
   * the run is acting as (manual = requesting user; scheduled =
   * automation.owner_user_id).
   */
  connections: AgentConnection[];
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
 *  - `agent_schema` object  → Cargo AI (native shape)
 *  - `inputs` or `actions` array → Cargo AI (looser fallback)
 *  - otherwise              → unrecognized
 *
 * If a file happens to have both (someone wrote a hybrid), we prefer
 * Pydantic AgentSpec because that's our canonical authoring format.
 */
function detectFramework(obj: Record<string, unknown>): Framework | null {
  const hasInstructions =
    typeof obj.instructions === "string" && obj.instructions.trim() !== "";
  if (hasInstructions) return "pydantic-agentspec";
  const hasAgentSchema =
    obj.agent_schema !== undefined &&
    obj.agent_schema !== null &&
    typeof obj.agent_schema === "object" &&
    !Array.isArray(obj.agent_schema);
  if (hasAgentSchema) return "cargo-ai";
  if (Array.isArray(obj.inputs) || Array.isArray(obj.actions)) return "cargo-ai";
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
  const connections = parseConnectionsField(obj.connections);
  return {
    spec: {
      ...base,
      framework: "pydantic-agentspec",
      model,
      instructions,
      connections,
    },
  };
}

/**
 * Extract `connections:` as a list of {toolkit, name} pairs.
 * Accepted shapes (loose → most explicit):
 *
 *   connections: [slack, googlesheets]
 *     → [{toolkit: "slack", name: "default"},
 *        {toolkit: "googlesheets", name: "default"}]
 *
 *   connections: [{slack: [SLACK_SEND_MESSAGE]}]
 *     → [{toolkit: "slack", name: "default"}]    (tools dropped — the
 *                                                 runner reads them)
 *
 *   connections: [{slack: {tools: [...]}}]
 *     → same as above
 *
 *   connections:
 *     - gmail: { name: "work" }
 *     - gmail: { name: "personal", tools: [...] }
 *     → two pairs, both toolkit gmail, names "work" and "personal".
 *
 *   connections: [{type: slack, name: "alt"}]
 *     → [{toolkit: "slack", name: "alt"}]    (verbose form)
 *
 * The runner uses the named slot to look up the right
 * workspace_composio_connection row at run time. Malformed entries
 * are dropped — the runner does the strict validation.
 */
function coerceSource(raw: unknown): AgentConnectionSource {
  return raw === "native-mcp" ? "native-mcp" : "composio";
}

function parseConnectionsField(raw: unknown): AgentConnection[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentConnection[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push({ toolkit: item.trim(), name: "default", source: "composio" });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;

    // Verbose form: { type|toolkit: "slack", name?: "alt", source?: "..." }
    const slug = o.type ?? o.toolkit;
    if (typeof slug === "string" && slug.trim()) {
      const name =
        typeof o.name === "string" && o.name.trim() ? o.name.trim() : "default";
      out.push({
        toolkit: slug.trim(),
        name,
        source: coerceSource(o.source),
      });
      continue;
    }

    // Compact form: single-key dict where the key IS the toolkit slug.
    // Value can be: list of tool slugs (narrow tools, no name), or
    // a dict carrying { name, tools, source }.
    const keys = Object.keys(o);
    if (keys.length === 1 && keys[0].trim()) {
      const toolkit = keys[0].trim();
      const body = o[keys[0]];
      let name = "default";
      let source: AgentConnectionSource = "composio";
      if (body && typeof body === "object" && !Array.isArray(body)) {
        const b = body as Record<string, unknown>;
        if (typeof b.name === "string" && b.name.trim()) {
          name = b.name.trim();
        }
        source = coerceSource(b.source);
      }
      out.push({ toolkit, name, source });
    }
  }
  return out;
}

function parseCargoAiSpec(
  obj: Record<string, unknown>,
  base: AgentSpecBase,
): ParseAgentResult | { spec: CargoAiSpec } {
  // The web layer's job is to extract `model` for run routing and pass
  // the raw bytes through; cargo-ai itself validates the rest of the
  // schema. Model placement varies (top-level vs `runtime_vars.model`);
  // we accept either flat shape, with null as the honest "didn't find
  // one" value so the UI renders "—" rather than guessing.
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
        "Not a recognized agent format. Pydantic AgentSpec needs `instructions`; Cargo AI needs an `agent_schema` (or `inputs` / `actions`) array.",
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

