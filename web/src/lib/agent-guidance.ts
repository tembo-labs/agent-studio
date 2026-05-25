import "server-only";

import type { Framework } from "@/lib/agent-framework";

// Guidance files dropped into the customer's repo alongside their
// first agent. The Tembo Coding Agent reads these before editing so
// PRs target the *native* framework shapes that the studio's
// passthrough runners actually execute.
//
// Why bake them into the repo instead of bundling them with TAS:
// they need to be visible to the coding agent at PR time, which is
// running against the customer's checkout — not the studio. Living
// in the repo also means customers can hand-edit them, just like
// they hand-edit the agent files themselves. Updates from the
// studio's side ship as new files in the starter template; existing
// repos can opt in by re-running the bootstrap (TBD), or by letting
// the coding agent suggest a guidance update in a PR.
//
// Keep these files SHORT. The coding agent loads them into its
// context every edit — every line costs tokens. Distill from
// upstream guidance rather than copying it verbatim.

export type GuidanceFile = {
  path: string;
  content: string;
};

const CARGO_AI_GUIDE: string = `# Cargo AI Agent Guide

This guide is for the **Tembo Coding Agent** when editing Cargo AI
agent files in this repo. TAS runs these files through the bundled
\`cargo-ai\` CLI as a passthrough — what's on disk is what executes.

## File shape

A Cargo AI agent is a single JSON file with these top-level fields,
in this order:

\`\`\`json
{
  "name": "my-agent",
  "description": "What this agent does.",
  "version": "2026-03-03.r1",
  "inputs": [ /* … */ ],
  "agent_schema": { /* … */ },
  "runtime_vars": { "model": "openai:gpt-4o-mini" },
  "actions": [ /* … */ ]
}
\`\`\`

- \`name\` and \`description\` are studio metadata. TAS strips them
  before handing the file to cargo-ai.
- \`version\` is required by cargo-ai. Current schema version is
  \`2026-03-03.r1\`. The studio injects it if you omit it, but keep
  it explicit so the file is portable.
- \`runtime_vars.model\` is **required**. Format: \`provider:model\`.
  Today only \`openai:\` providers work (cargo-ai 0.3 ships an
  OpenAI provider only).
- \`agent_schema\` and \`inputs\` carry the LLM contract.
- \`actions\` is post-LLM side-effects, **not** pre-LLM steps.

## inputs[]

The data fed to the LLM. Each entry is one of:

- \`{ "type": "text", "text": "…" }\` — literal prompt text.
- \`{ "type": "url", "url": "https://…" }\` — cargo-ai GETs this
  URL and feeds the body as text. **GET only.** For POSTs or auth
  headers, use an \`exec\` action with \`curl\`.
- \`{ "type": "image", "path": "relative/path.png" }\` — local image.
- \`{ "type": "file", "path": "relative/path.txt" }\` — local file.

Paths must be **relative** and must not use \`../\`.

The studio appends any chat user-message as a trailing \`text\` input.
You don't need to add a "user input goes here" placeholder.

## agent_schema

JSON Schema describing the LLM's output. The model is forced to
return JSON matching this schema. Example:

\`\`\`json
"agent_schema": {
  "type": "object",
  "properties": {
    "summary":   { "type": "string", "description": "1-paragraph summary" },
    "sentiment": { "type": "string", "enum": ["positive", "neutral", "negative"] },
    "score":     { "type": "number", "minimum": 0, "maximum": 1 }
  },
  "required": ["summary", "sentiment"]
}
\`\`\`

If \`properties\` is empty, cargo-ai **skips the LLM call** and goes
straight to actions. That's a valid pattern for pure-side-effect
agents (e.g. "fetch URL and email me the contents").

## actions[]

Conditional side-effects that run **after** the LLM call. Cargo-ai
evaluates each action's \`logic\` (JSONLogic) and runs the matching
ones; multiple can fire in one run.

\`\`\`json
"actions": [
  {
    "name": "notify_on_negative",
    "logic": { "==": [{ "var": "sentiment" }, "negative"] },
    "run": [
      { "kind": "exec", "program": "curl", "args": [
        "-X", "POST", "https://hooks.slack.com/…",
        "-d", { "var": "summary" }
      ]}
    ]
  }
]
\`\`\`

### Action step kinds

- **\`exec\`** — shell command. Required: \`program\`, \`args\`.
  Optional: \`output_variable\` (captures stdout), \`failure_mode\`.
  Use this for arbitrary HTTP via \`curl\`, file writes, anything
  the host can run.
- **\`tool\`** — call a project-local Cargo AI tool defined under
  \`.cargo-ai/tools/\`. Required: \`name\`. Optional: \`params\`,
  \`output_variable\`. Tool authoring is its own workflow — see
  https://github.com/analyzer1/cargo-ai for details.
- **\`agent\`** — invoke another agent file. Required: \`agent\`
  (path). Use for multi-stage workflows where one agent's output
  feeds another.
- **\`email_me\`** — send the user an email. Required: \`subject\`,
  \`text\`. Requires email provider configured.
- **\`generate_image\`** — generate an image. Required: \`prompt\`,
  \`path\`. Optional: \`model\`, \`profile\`.

### Action control fields

- \`when\` — JSONLogic, evaluated per-step. Skip the step if false.
- \`failure_mode\` — \`stop\` (default), \`continue\`, or \`abort\`.
- \`platform\` — restrict to \`macos\`, \`linux\`, or \`windows\`
  (or an array). Skipped silently on other platforms.
- \`status_variable\`, \`error_variable\`, \`output_variable\` —
  capture step results into named vars for later steps.

### Variable references

In \`logic\`, \`when\`, exec \`args\`, etc., use \`{ "var": "name" }\`:

- \`{ "var": "summary" }\` — a top-level field from \`agent_schema\`.
- \`{ "var": "runtime.foo" }\` — a runtime variable passed at
  invocation time (declared under \`runtime_vars\`).
- \`{ "var": "step_output_name" }\` — an \`output_variable\` from
  an earlier step in the same action.

## Studio-specific notes

- **Don't add a "print the result" action.** TAS injects an
  \`_tas_emit_output\` action automatically so the LLM's reply
  reaches the run log. You handle real side-effects; the studio
  handles output rendering.
- **Provider:** only \`openai:\` works in cargo-ai 0.3. The TAS
  runner errors clearly if you set \`anthropic:\` etc.
- **No simplified shape.** The studio used to translate a simpler
  \`actions: [{id, type: "llm", prompt}]\` shape into cargo-ai
  native. That translator is gone. Write native cargo-ai now.

## Patterns to recognize

- **Pure LLM agent** → \`inputs[]\` + \`agent_schema\` + no
  \`actions[]\`. Studio handles output. Use for "summarize",
  "classify", "extract", "answer".
- **LLM with conditional notify** → add one \`actions[]\` entry
  gated by JSONLogic on a schema field.
- **Pre-LLM HTTP fetch** → put the URL in \`inputs[]\` as
  \`{type: "url"}\`. For POSTs, use a separate \`exec\` action.
- **Pure action runner** → \`agent_schema: { type: "object",
  properties: {} }\` skips the LLM. Use named top-level inputs
  and \`--input-override\` to parameterize at runtime.

## Quick reference: minimal valid file

\`\`\`json
{
  "name": "greet",
  "description": "Friendly greeter.",
  "version": "2026-03-03.r1",
  "inputs": [
    { "type": "text", "text": "Greet warmly and briefly." }
  ],
  "agent_schema": {
    "type": "object",
    "properties": { "greeting": { "type": "string" } },
    "required": ["greeting"]
  },
  "runtime_vars": { "model": "openai:gpt-4o-mini" }
}
\`\`\`
`;

const PYDANTIC_GUIDE: string = `# Pydantic AI AgentSpec Guide

This guide is for the **Tembo Coding Agent** when editing Pydantic
AI agent files (\`.yaml\` or \`.json\`) in this repo. TAS runs these
files through the bundled \`pydantic-ai\` library as a passthrough —
what's on disk is what executes.

## File shape

A Pydantic AI agent is a single YAML or JSON file (YAML preferred
for diff readability). Required + most common fields:

\`\`\`yaml
name: my-agent
model: anthropic:claude-sonnet-4-6
description: What this agent does.
instructions: |
  You are a helpful agent. Use clear, concise prose.
  Cite sources where relevant.
model_settings:
  max_tokens: 4096
output_schema:
  type: object
  properties:
    answer: { type: string }
    confidence: { type: number, minimum: 0, maximum: 1 }
  required: [answer]
\`\`\`

### Top-level fields

- **\`name\`** (required by TAS) — agent identifier. Must match
  the filename (\`name: foo\` → \`foo.yaml\`). 2–64 chars, lowercase,
  digits, hyphens.
- **\`model\`** (required) — format \`provider:model\`. Examples:
  \`anthropic:claude-sonnet-4-6\`, \`openai:gpt-4o-mini\`,
  \`openai:gpt-5.2\`. The provider's API key must be set under
  the workspace's Settings → API keys.
- **\`description\`** (optional) — one-line summary. Shows in the
  TAS agent list.
- **\`instructions\`** (required by TAS) — system prompt as a string
  or block scalar. Pydantic AI accepts a list of strings too, but
  TAS's parser currently only handles a single string. Use \`|\` for
  multi-line.

### model_settings

Free-form dict passed straight to the provider SDK. Most useful
keys:

- \`max_tokens: 4096\` — cap on response length.
- \`temperature: 0.7\` — sampling temperature.
- \`top_p\`, \`frequency_penalty\`, \`presence_penalty\` — standard
  provider knobs.

### output_schema

JSON Schema for the agent's structured output. When present,
pydantic-ai forces the model to return JSON matching this schema
and validates the result. Without \`output_schema\`, the agent
returns a string.

\`\`\`yaml
output_schema:
  type: object
  properties:
    intent: { type: string, enum: [question, complaint, praise, other] }
    urgency: { type: integer, minimum: 1, maximum: 5 }
  required: [intent]
\`\`\`

### deps_schema

JSON Schema for *runtime dependencies* the agent expects to be
injected. TAS doesn't yet provide a way for chat callers to supply
deps — leave this off unless authoring a code-driven agent.

### capabilities

First-class agent features. Three syntactic forms:

\`\`\`yaml
capabilities:
  - WebSearch                  # no args
  - WebSearch: duckduckgo      # one positional arg
  - Thinking:                  # kwargs
      effort: high
\`\`\`

Common capabilities:

- \`WebSearch\` — agent can search the web. Some variants take a
  provider (\`duckduckgo\`, \`tavily\`, etc.).
- \`Thinking\` — extended reasoning. Set \`effort: low|medium|high\`.
- \`CodeExecution\` — provider-native code interpreter (where
  supported).
- \`FileSearch\` — provider-native file retrieval.

### retries

Integer or struct. Default behavior is provider-determined. Set
\`retries: 3\` for resilient agents.

### instrument

\`instrument: true\` lights up Logfire / OTel tracing. Recommended
for production agents.

## Studio-specific notes

- **API keys come from the workspace, not the file.** Don't put
  \`openai_api_key\` or \`anthropic_api_key\` in the YAML. The
  studio injects whichever workspace secret matches the agent's
  \`model:\` provider.
- **YAML or JSON both work.** Pick whichever the team finds easier
  to review. YAML's strength is multi-line \`instructions:\`.
- **Tools** declared declaratively in AgentSpec require their
  Python function definitions to live elsewhere — not supported by
  TAS yet. Stick to \`capabilities:\` for tool-like behavior in
  declarative agents.
- **\`instructions\` is non-optional in TAS.** Even if pydantic-ai
  allows omitting it, TAS's parser rejects files without
  \`instructions\` to keep the diff-review experience honest
  (an agent without instructions is hard for a reviewer to assess).

## Patterns to recognize

- **Q&A agent** → \`instructions:\` + \`output_schema:\` returning
  \`{ answer, citations[] }\`. Add \`capabilities: [WebSearch]\` if
  the answer needs current data.
- **Classifier** → \`instructions:\` + \`output_schema:\` with an
  \`enum\` field. Tight \`max_tokens\` (e.g. 100).
- **Long-form writer** → \`instructions:\` + no \`output_schema\`
  (string output) + generous \`max_tokens\` (4096+).
- **Multi-step reasoner** → add \`capabilities: [Thinking: { effort:
  high }]\` and a permissive \`max_tokens\`.

## Quick reference: minimal valid file

\`\`\`yaml
name: greet
model: anthropic:claude-sonnet-4-6
description: Friendly greeter.
instructions: |
  You are a friendly agent.
  Greet the user warmly and answer briefly.
model_settings:
  max_tokens: 512
\`\`\`
`;

const AGENTS_INDEX: string = `# Agent authoring guide for the Tembo Coding Agent

This directory holds **agent definition files** — declarative
specs that the Tembo Agent Studio (TAS) runs as-is.

## Two supported frameworks

- **Pydantic AI AgentSpec** (\`.yaml\` or \`.json\`) — the canonical
  authoring format. See \`pydantic-agentspec/AGENT_GUIDE.md\`.
- **Cargo AI** (\`.json\`) — supported for customers with existing
  Cargo AI assets. See \`cargo-ai/AGENT_GUIDE.md\`.

When editing an agent file, **read the matching guide first**.
TAS runs both frameworks as passthrough — what's in the file is
exactly what executes. Wrong shape = run fails.

## When to use which

- Default to Pydantic AI AgentSpec for new agents (broader provider
  support, richer features, better diff readability via YAML).
- Use Cargo AI when the customer already has Cargo AI agents and is
  porting their workflow in.

## File layout

\`\`\`
agents/
├── AGENTS.md                              ← this file
├── pydantic-agentspec/
│   ├── AGENT_GUIDE.md                     ← read before editing .yaml/.json here
│   ├── hello-world.yaml
│   └── …
└── cargo-ai/
    ├── AGENT_GUIDE.md                     ← read before editing .json here
    ├── hello-world.json
    └── …
\`\`\`
`;

export function guidanceFilesFor(framework: Framework): GuidanceFile[] {
  // Both files always land — the index lives at agents/AGENTS.md so
  // it's visible regardless of which framework the customer started
  // with, and each framework's per-directory guide lives under its
  // own subdir. Idempotent on commit: if the file already exists at
  // the same content we skip writing (handled by the caller).
  const files: GuidanceFile[] = [{ path: "agents/AGENTS.md", content: AGENTS_INDEX }];
  if (framework === "cargo-ai") {
    files.push({
      path: "agents/cargo-ai/AGENT_GUIDE.md",
      content: CARGO_AI_GUIDE,
    });
  } else {
    files.push({
      path: "agents/pydantic-agentspec/AGENT_GUIDE.md",
      content: PYDANTIC_GUIDE,
    });
  }
  return files;
}

/** Both guides regardless of which framework triggered the bootstrap.
 *  Useful for a "write all guidance" path (workspace settings page,
 *  manual re-bootstrap, etc.). */
export function allGuidanceFiles(): GuidanceFile[] {
  return [
    { path: "agents/AGENTS.md", content: AGENTS_INDEX },
    { path: "agents/cargo-ai/AGENT_GUIDE.md", content: CARGO_AI_GUIDE },
    {
      path: "agents/pydantic-agentspec/AGENT_GUIDE.md",
      content: PYDANTIC_GUIDE,
    },
  ];
}
