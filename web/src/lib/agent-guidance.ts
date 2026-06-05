import "server-only";

import { createHash } from "node:crypto";

import type { Framework } from "@/lib/agent-framework";
import { listMcpProviders } from "@/lib/mcp-providers";

// Backtick-wrapped slugs of the current Native MCP catalog, interpolated
// into the guide so it always lists the live providers (and the guidance
// version hash changes when the catalog does → repos re-bootstrap).
const NATIVE_MCP_SLUGS: string = listMcpProviders()
  .map((p) => "`" + p.slug + "`")
  .join(", ");

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
export const TAS_APP_VERSION = "0.4";

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
  \`anthropic:claude-opus-4-8\`, \`anthropic:claude-sonnet-4-6\`,
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

- **First-run + iterating: start on \`anthropic:claude-opus-4-8\`
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

### tools_module (TAS extension — deterministic Python tools)

Point the agent at a sibling Python file of **deterministic functions
the model calls as tools**. Use this when work is rote — data
transforms, scoring, matching, pagination loops, ETL — so the function
runs in Python at **no token cost** and the LLM just *supervises* which
function to call. This is the cost + speed lever versus making the model
do everything through MCP/Composio tool calls.

\`\`\`yaml
name: revenue-rollup
model: anthropic:claude-sonnet-4-6
tools_module: revenue_tools.py        # a sibling file: agents/pydantic-agentspec/revenue_tools.py
instructions: |
  Call summarize_arr to compute the monthly ARR waterfall, then post a
  one-paragraph summary. Don't recompute anything yourself.
\`\`\`

Rules:

- **\`tools_module\`** is a **bare filename** (no \`/\`, no \`..\`),
  resolved next to the agent spec. It must end in \`.py\`.
- The module **must** define a top-level \`tools = [...]\` list of the
  functions to expose. Helpers not in that list stay private.
- pydantic-ai builds each tool's schema from the **function signature +
  docstring** — so type the parameters and write a clear one-line
  docstring. That text is what the model sees.
- A declared module that's missing from the repo (or whose \`tools\`
  list is empty / non-callable) **fails the run** loudly — it never
  silently runs without the tools.
- Tool calls show up in the run detail + the **Tool uses** view by
  function name, same as MCP tools.

**Auth flows through Connections — never hardcode a key.** When a tool
needs to reach an external system, import the bundled \`tas_tools\`
helper and ask for a connection the agent already declares under
\`connections:\` (Native MCP only — its OAuth token also works against
the provider's REST API):

\`\`\`python
# agents/pydantic-agentspec/revenue_tools.py
import httpx
import tas_tools

def list_companies() -> list[dict]:
    """Return all Attio companies."""
    c = tas_tools.connection("attio")          # the agent's attio connection
    r = httpx.get(
        "https://api.attio.com/v2/objects/companies/records/query",
        headers={"Authorization": f"Bearer {c.access_token}"},
    )
    r.raise_for_status()
    return r.json()["data"]

def summarize_arr(records: list[dict]) -> dict:
    """Compute the monthly ARR waterfall from company records."""
    ...

tools = [list_companies, summarize_arr]
\`\`\`

For a service that authenticates with a **plain API key** (e.g. Clay)
rather than OAuth — i.e. not a Composio or Native-MCP provider — use a
**Secret**. An admin sets it once under Connections → Secrets
(workspace-level, shared); the tool reads it by name:

\`\`\`python
import httpx
import tas_tools

def enrich(domain: str) -> dict:
    """Enrich a company domain via Clay."""
    key = tas_tools.secret("clay")             # a workspace Secret
    r = httpx.post(
        "https://api.clay.com/v1/enrich",
        headers={"Authorization": f"Bearer {key}"},
        json={"domain": domain},
    )
    r.raise_for_status()
    return r.json()

tools = [enrich]
\`\`\`

Optionally declare the secret in \`connections:\` so the studio prompts an
admin to set it if it's missing — it attaches no tools and is invisible to
the model:

\`\`\`yaml
connections:
  - { type: clay, source: secret }
\`\`\`

Standard library + \`httpx\` + \`pydantic\` are available. For other
third-party deps (pandas, drivers), add a pinned line to
\`api/scripts/requirements-tools.txt\` in the TAS deployment and redeploy.

### connections

External services this agent calls at run time. Each entry resolves
at run time to a connection the **acting user** of the run has
authorized in the workspace.

TAS has three connection substrates and the agent file picks between
them per-entry with a \`source:\` field:

| \`source:\`    | When to pick it                                     |
|---------------|-----------------------------------------------------|
| \`composio\`    | Default. ~250 services wrapped as REST tools by Composio. Slugs are lowercase (\`slack\`, \`googlesheets\`). |
| \`native-mcp\`  | Provider has an official MCP server — richer tools, schema-aware operations, fewer round trips, TAS-managed OAuth (no per-customer credentials). Slugs from TAS's native catalog (currently: ${NATIVE_MCP_SLUGS}). |
| \`secret\`      | A plain **API key** (e.g. Clay) for a service with no OAuth — set workspace-wide under Connections → Secrets, read by sidecar Python tools via \`tas_tools.secret("slug")\`. Attaches no tools; declaring it only surfaces the missing-secret prompt. See \`tools_module\` above. |

The default when \`source:\` is omitted is \`composio\` — existing
agents need no edit.

**Prefer Native MCP over Composio when the provider is in TAS's
native catalog above.** It uses the provider's official MCP server
(better, schema-aware tools) and TAS-managed OAuth (the user just
clicks Connect — no bring-your-own OAuth app). Only use the
Composio \`source\` for a provider that isn't in the native catalog.
Note the tool slugs differ between the two substrates for the same
provider — if you switch a connection from Composio to native (or
vice-versa), re-copy the tool slugs from the Tools tab; the old
\`tools:\` list won't match.

**Canonical form** — named slot + narrow tools for Composio, named
slot for Native MCP. Pin the slot name (so users can hold multiple
accounts) and, for Composio, list the exact tools the agent calls
so only those schemas land in the model's context (~10× cheaper
input tokens per run vs. the loose search-and-execute path):

\`\`\`yaml
connections:
  # Composio (default source)
  - gmail:
      name: default
      tools: [GMAIL_SEND_EMAIL]
  - googlesheets:
      name: default
      tools: [GOOGLESHEETS_BATCH_GET]

  # Native MCP — provider's official server, TAS-managed OAuth.
  - { type: attio, source: native-mcp, name: default }
\`\`\`

\`name: default\` is what a single-account workspace uses; pick
something descriptive like \`work\` / \`personal\` / \`customer-support\`
when the user holds multiple accounts of the same provider.

When a TAS create-agent prompt includes a "Connection slots already
authorized in this workspace" header, **use those slot names
verbatim** instead of \`default\` — the user has already authorized
those slots, and writing a slot name they haven't authorized makes
the agent fail to run until they authorize it. Only fall back to
\`default\` for a provider that isn't in the header.

**Finding tool slugs.** Every cached tool for the workspace is
visible at \`/<workspace>/tools\` (the **Tools** tab in the
sidebar). Search / filter by source or provider and **copy the
slug verbatim** into \`tools: [...]\` or your prompt. Case +
separators are provider-determined and inconsistent across
providers:

- Composio uses UPPER_SNAKE_CASE — e.g. \`SLACK_SEND_MESSAGE\`,
  \`GOOGLESHEETS_BATCH_GET\`.
- Attio (Native MCP) uses kebab-case — e.g. \`run-basic-report\`,
  \`create-record\`, \`add-record-to-list\`.
- Other Native MCP providers may use snake_case, camelCase, or
  something else; do not assume.

Tool calls fail silently if the slug case is wrong, so always copy
from the Tools tab rather than guessing. If a slug you need isn't
visible, the connection's cache may be stale — refresh it from the
Connections page.

**\`tools:\` narrowing works on both substrates.** For Composio it
flips the agent into DIRECT_TOOLS mode (only those schemas land in
the model's context, no search/execute meta-tools). For Native MCP
the wrapper drops the full tool list down to just the named slugs
via a filtered toolset — same effect on context size and steering.
Slug match is exact, so copy verbatim from the Tools tab
(\`run-basic-report\`, not \`run_basic_report\`). Omitting \`tools:\`
on a Native MCP entry exposes every tool the MCP server publishes.

**Shorter forms** that resolve to the same shape (use sparingly —
prefer the explicit form above so future readers can grok the file
without learning shortcut rules). All shortcuts default to
\`source: composio\`; Native MCP requires the verbose form:

\`\`\`yaml
connections:
  # Loose — all tools, default slot, composio. The model has to
  # discover actions via meta-tools at run time. Token cost is
  # higher.
  - slack

  # Narrow tools, default slot, composio. Same DIRECT_TOOLS path
  # as the canonical form above.
  - slack: [SLACK_SEND_MESSAGE]

  # Named slot, loose tools, composio.
  - gmail: { name: work }

  # Verbose composio — same as canonical, single line.
  - { type: slack, name: alt, tools: [SLACK_SEND_MESSAGE] }

  # Verbose native-mcp — only way to pick this source.
  - { type: attio, source: native-mcp, name: default }
\`\`\`

Forms can mix in the same file.

**Toolkit slugs are exact — verify, don't guess.** A service's
Composio slug is often NOT just its lowercased name: integrations
can carry suffixes or differ from the brand (e.g. Pylon is
\`pylon_mcp\`, not \`pylon\`). A wrong slug can't be connected — the
Connections page flags it "Not a recognized Composio toolkit" and
the agent never runs. These common slugs are safe to write from
memory: \`slack\`, \`gmail\`, \`googlesheets\`, \`googlecalendar\`,
\`googledocs\`, \`googledrive\`, \`notion\`, \`github\`, \`linear\`,
\`hubspot\`, \`salesforce\`, \`airtable\`, \`asana\`, \`jira\`. For
**anything else, confirm the exact slug** before writing it into
\`connections:\` — look it up at https://composio.dev/toolkits (the
slug is in the toolkit's URL/page) or ask the user. If you can't
verify it, say so rather than guessing.

Also note: not every Composio toolkit has Composio-managed
credentials. Some (often \`*_mcp\` ones) are bring-your-own-auth —
an admin must create a custom auth config for them once at
dashboard.composio.dev before they can be connected.

**Native MCP providers** (currently: ${NATIVE_MCP_SLUGS}). The
catalog grows when TAS adds an entry to \`lib/mcp-providers.ts\` —
check the Connections page's "Native MCP connections" section for
the current list. If the provider you need IS here, use
\`source: native-mcp\` (preferred). If it isn't, fall back to
\`composio\` (assuming the service has a Composio toolkit).

Studio rules:

- **Connections are per-user.** Every workspace member authorizes
  their own. A manual "Run now" uses the requesting user's
  connections; a scheduled automation uses its **Run as** owner's
  connections (set on the automation form, defaults to whoever
  created it). The runner fails fast if the acting user hasn't
  authorized a declared (source, provider, name) triple.
- **Authorize first, declare second.** Once an agent declares a
  connection, every member who'll run it sees a "Connect X for Y"
  alert in their sidebar until they authorize.
- **No credentials in the file.** Composio holds tokens in their
  vault; Native MCP tokens live encrypted in TAS's database. The
  agent file just names the (source, provider, name) triple.
- **Slugs are case-sensitive.** Composio toolkit slugs are
  lowercase (\`googlesheets\`, not \`google-sheets\`). Composio tool
  slugs are uppercase (\`SLACK_SEND_MESSAGE\`). Native MCP provider
  slugs are lowercase; tool slugs are provider-determined (copy
  from the Tools tab verbatim).
- **Renames break references.** Renaming a slot in the UI (e.g.
  \`default\` → \`work\`) updates the connection row but every
  agent file pinning \`name: default\` will fail until you also
  edit the file. Grep this folder for the old name when you
  rename.

### Switching an agent from Composio to Native MCP

Common evolution: an agent starts on Composio's wrapper for a
service and the provider later ships an official MCP server with
richer tools. To switch:

\`\`\`yaml
# Before
connections:
  - attio

# After
connections:
  - { type: attio, source: native-mcp, name: default, tools: [run-basic-report] }
instructions: |
  …existing prompt…
  Use the \`run-basic-report\` tool to summarise weekly activity.
\`\`\`

Then have the user re-authorize: open Connections, click **Connect**
on the Attio row in the "Native MCP connections" section. The old
Composio Attio connection can be disconnected separately.

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
- **Event/webhook runs pass a JSON envelope as the input.** A run
  fired by an external webhook (e.g. Clay) or a Composio trigger
  receives its \`user_message\` as a JSON string shaped like
  \`{ "trigger_type": "webhook", "webhook": "<name>", "payload": <the
  sender's body> }\` (Composio events use \`trigger_type\` +
  \`payload\` similarly). Write the agent's instructions to parse this
  envelope and read \`payload\`; for ETL-style work, a
  \`tools_module\` function does the field mapping + the write-back.

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
