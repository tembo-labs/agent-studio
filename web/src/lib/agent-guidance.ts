import "server-only";

import { createHash } from "node:crypto";

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
// they hand-edit the agent files themselves.
//
// Keeping them current across upgrades: every coding request the
// studio sends carries TAS_APP_VERSION + TAS_GUIDANCE_VERSION plus
// the canonical guidance content. The coding agent diffs against
// the version markers on disk and refreshes any stale files in the
// same PR as the requested change. See cap-api.ts → buildGuidanceBlock.
//
// Keep these files SHORT. The coding agent loads them into its
// context every edit — every line costs tokens. Distill from
// upstream guidance rather than copying it verbatim.

export type GuidanceFile = {
  path: string;
  content: string;
};

// Major.minor of the studio. Bump in lockstep with the v0.x phase
// we're shipping; coding agents pass this through to PR bodies so
// reviewers can spot if a PR was authored against a now-deprecated
// TAS version.
export const TAS_APP_VERSION = "0.2";

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
  \`anthropic:claude-opus-4-7\`, \`anthropic:claude-sonnet-4-6\`,
  \`openai:gpt-5.2\`, \`openai:gpt-4o-mini\`. The provider's API key
  must be set under the workspace's Settings → API keys. See
  *Choosing a model* below for which to pick.
- **\`description\`** (optional) — one-line summary. Shows in the
  TAS agent list.
- **\`instructions\`** (required by TAS) — system prompt as a string
  or block scalar. Pydantic AI accepts a list of strings too, but
  TAS's parser currently only handles a single string. Use \`|\` for
  multi-line.

### Choosing a model

Model choice is a cost/reliability tradeoff. Default playbook:

- **First-run + iterating: start on \`anthropic:claude-opus-4-7\`
  for any agent that calls tools** (i.e. declares \`connections:\`).
  Tool-using agents need to decide when to act without follow-up
  questions, and lower-tier models (Sonnet, GPT-4o-mini) tend to
  hedge — replying "would you like me to…" instead of executing.
  Opus is more decisive out of the box, which makes it easier to
  prove the agent works before you optimise.
- **Once the agent runs reliably on Opus, try downgrading.**
  \`anthropic:claude-sonnet-4-6\` is ~5× cheaper input, ~5× cheaper
  output. Sonnet usually works fine when:
    - the agent uses the narrow \`connections:\` form (so the model
      sees specific tool slugs, not a search dance);
    - the \`instructions:\` are imperative ("when invoked, do X")
      rather than descriptive ("you can help with X");
    - the agent has a single well-defined job rather than a vague
      "be a helpful assistant about Y" role.
  If Sonnet hedges on tool calls, go back to Opus and don't fight it.
- **No tools? Sonnet is the right starting point** — the hedging
  problem only shows up with tool use.
- **OpenAI alternatives**: \`openai:gpt-5.2\` is roughly Opus-tier
  for tool-use reliability; \`openai:gpt-4o-mini\` and
  \`openai:gpt-4.1-mini\` are roughly Sonnet-tier. The Anthropic /
  OpenAI choice is a separate axis from the tier — pick based on
  which provider key the workspace has + which provider your team
  is already auditing for governance.

The runtime tracks \`tokens_input\`, \`tokens_output\`, and
\`cost_usd\` per run, so the downgrade decision is a measurement,
not a guess: run a handful of times on Opus, look at the Runs page
Cost column, then try Sonnet and compare side-by-side.

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

### connections

External services this agent calls at run time (Slack, Google
Sheets, etc.). Each entry is a Composio toolkit slug. The Studio
exposes the corresponding tools to the agent via an MCP toolset
that the workspace's authorized Composio connections back.

**Loose form** — gives the agent access to every tool in the
toolkit. The model uses Composio's search meta-tool to find the
right action at run time. Reasonable when an agent might need any
of a toolkit's actions; **expensive when it really only uses one
or two** (the model still pays for the discovery round trip).

\`\`\`yaml
connections:
  - slack
  - googlesheets
\`\`\`

**Narrow form** — declare exactly the tool slugs the agent calls.
The Studio uses Composio's \`DIRECT_TOOLS\` preset, preloads only
those schemas, and skips the discovery round trip. Significantly
cheaper per run, and the model knows what tool to call without
guessing. Prefer this when the agent's job is well-defined (e.g.
"read this sheet and post to this channel").

\`\`\`yaml
connections:
  - slack: [SLACK_SEND_MESSAGE]
  - googlesheets: [GOOGLESHEETS_BATCH_GET]
\`\`\`

Both forms can mix in the same file. A toolkit without an explicit
tool list defaults to the loose behavior for that toolkit.

**Toolkit slugs** are whatever Composio uses. Common ones:
\`slack\`, \`gmail\`, \`googlesheets\`, \`googlecalendar\`,
\`googledocs\`, \`googledrive\`, \`notion\`, \`github\`, \`linear\`,
\`hubspot\`, \`salesforce\`, \`airtable\`, \`asana\`, \`jira\`. The
full catalog (hundreds) lives at
https://composio.dev/toolkits — anything there is reachable. TAS
doesn't maintain an allowlist; declare whatever the agent needs.
The user will see a Connect button for each declared toolkit under
Settings → Connections.

Studio rules:

- **Authorize first, declare second.** The workspace must have
  authorized each toolkit under Settings → Connections before a
  run; the runner fails fast otherwise.
- **No credentials in the file.** The agent file declares *which*
  toolkits it needs; the actual OAuth tokens live in Composio's
  vault, scoped per workspace.
- **Slugs are case-sensitive.** Toolkit slugs are lowercase
  (\`googlesheets\`, not \`google-sheets\`). Tool slugs are
  uppercase (\`SLACK_SEND_MESSAGE\`).

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

// Repo-root AGENTS.md — the conventional entry point coding agents
// read first (OpenAI/Anthropic convention). TAS-managed: refresh on
// drift, same semantics as the agents/ subdir guides. Customer
// customizations live in ADDITIONAL_AGENT_INSTRUCTIONS.md, which TAS
// creates once and never touches again.
const ROOT_AGENTS_INDEX: string = `# Repository guide

This repository holds agent definitions managed by **Tembo Agent
Studio (TAS)**. TAS reads, runs, and (via the Tembo Coding Agent
Platform) edits the files under \`agents/\`.

## Where to look

- \`agents/\` — agent definition files (YAML or JSON). Read
  \`agents/AGENTS.md\` before editing anything here. Each framework
  subfolder has its own \`AGENT_GUIDE.md\` with the canonical file
  shape.
- \`ADDITIONAL_AGENT_INSTRUCTIONS.md\` — project-specific instructions
  the customer maintains. Always read this alongside the studio's
  guidance; the two layer on top of each other.

## TAS-managed files

These files are owned by the studio and refreshed automatically on
every coding-agent request. Hand edits won't survive:

- \`AGENTS.md\` (this file)
- \`agents/AGENTS.md\`
- \`agents/pydantic-agentspec/AGENT_GUIDE.md\`
- \`agents/cargo-ai/AGENT_GUIDE.md\`

Each starts with a version marker:
\`<!-- tas-guidance-version: <hash> -->\`. Don't change it.

## Project-specific overrides

To add conventions, constraints, or pointers that should layer on top
of TAS defaults, edit \`ADDITIONAL_AGENT_INSTRUCTIONS.md\` instead of
this file. That file is customer territory and TAS will never modify
it.
`;

// Customer-managed customization slot. TAS creates this once with a
// minimal starter, then leaves it alone forever. The coding agent
// reads it alongside AGENTS.md so the customer can layer project-
// specific instructions on top of the studio defaults without
// having to fork the studio.
const ADDITIONAL_INSTRUCTIONS_TEMPLATE: string = `# Additional agent instructions

This file is **customer territory**. Add project-specific instructions
for the Tembo Coding Agent here — they layer on top of the studio
defaults in \`AGENTS.md\` and \`agents/AGENTS.md\`.

TAS created this file once and will not modify it again. Edit freely.

## Examples

(Delete these once you have real content.)

- "Prefer YAML over JSON for new agent files."
- "Don't add new Cargo AI agents — we're consolidating on Pydantic."
- "See \`docs/agent-review-policy.md\` for our PR review rules."
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

## Keeping this guide current

Every coding request from TAS carries the studio's current guidance
content plus a version marker. The first line of each file in this
directory is an HTML comment of the form:

\`\`\`
<!-- tas-guidance-version: <hash> -->
\`\`\`

**Refresh-first protocol.** Before doing the requested change, the
coding agent compares the version marker on each guidance file in
the repo to the version sent by TAS. Any file that is missing or
whose marker differs is overwritten with the canonical content from
the prompt. The refresh lands in the same PR as the requested
change.

The studio's content is authoritative — hand edits to these files
will not survive the next coding request.
`;

// Content-hash version. Any change to any of the three guide
// strings above changes the hash; coding agents use this to detect
// stale on-disk copies of these files in the customer's repo and
// refresh them in-place during the same PR (see cap-api.ts).
export const TAS_GUIDANCE_VERSION: string = createHash("sha256")
  .update(AGENTS_INDEX)
  .update("\0")
  .update(CARGO_AI_GUIDE)
  .update("\0")
  .update(PYDANTIC_GUIDE)
  .digest("hex")
  .slice(0, 12);

// HTML comment marker at the top of every committed guide file.
// HTML so it's invisible in rendered markdown but easy to match
// with a regex when checking for staleness.
function withVersionMarker(content: string): string {
  return `<!-- tas-guidance-version: ${TAS_GUIDANCE_VERSION} -->\n${content}`;
}

export const GUIDANCE_ROOT_PATH = "AGENTS.md";
export const GUIDANCE_ADDITIONAL_PATH = "ADDITIONAL_AGENT_INSTRUCTIONS.md";
export const GUIDANCE_INDEX_PATH = "agents/AGENTS.md";
export const GUIDANCE_PYDANTIC_PATH = "agents/pydantic-agentspec/AGENT_GUIDE.md";
export const GUIDANCE_CARGO_AI_PATH = "agents/cargo-ai/AGENT_GUIDE.md";

// Customer-managed instructions slot. Created once, never refreshed.
// No version marker — TAS treats this file as opaque after first
// write. Returned separately from guidanceFilesFor so the bootstrap
// can take the create-only path on it.
export function additionalInstructionsFile(): GuidanceFile {
  return {
    path: GUIDANCE_ADDITIONAL_PATH,
    content: ADDITIONAL_INSTRUCTIONS_TEMPLATE,
  };
}

export function guidanceFilesFor(framework: Framework): GuidanceFile[] {
  // Root AGENTS.md + agents/AGENTS.md ship every time so the coding
  // agent finds them whether it starts from the repo root or from
  // the agents/ subdir. Each framework's per-directory guide lives
  // under its own subdir. Idempotent on commit: if the file already
  // exists at the same content we skip writing (handled by the
  // caller).
  const files: GuidanceFile[] = [
    { path: GUIDANCE_ROOT_PATH, content: withVersionMarker(ROOT_AGENTS_INDEX) },
    { path: GUIDANCE_INDEX_PATH, content: withVersionMarker(AGENTS_INDEX) },
  ];
  if (framework === "cargo-ai") {
    files.push({
      path: GUIDANCE_CARGO_AI_PATH,
      content: withVersionMarker(CARGO_AI_GUIDE),
    });
  } else {
    files.push({
      path: GUIDANCE_PYDANTIC_PATH,
      content: withVersionMarker(PYDANTIC_GUIDE),
    });
  }
  return files;
}

/** All TAS-managed guides regardless of which framework triggered
 *  the bootstrap. Useful for a "write all guidance" path (workspace
 *  settings page, manual re-bootstrap, etc.). Does not include the
 *  customer-managed ADDITIONAL_AGENT_INSTRUCTIONS.md — that's
 *  bootstrapped separately via additionalInstructionsFile(). */
export function allGuidanceFiles(): GuidanceFile[] {
  return [
    { path: GUIDANCE_ROOT_PATH, content: withVersionMarker(ROOT_AGENTS_INDEX) },
    { path: GUIDANCE_INDEX_PATH, content: withVersionMarker(AGENTS_INDEX) },
    {
      path: GUIDANCE_CARGO_AI_PATH,
      content: withVersionMarker(CARGO_AI_GUIDE),
    },
    {
      path: GUIDANCE_PYDANTIC_PATH,
      content: withVersionMarker(PYDANTIC_GUIDE),
    },
  ];
}
