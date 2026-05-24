# Agent Format Decision (v0.1)

> **Status:** Accepted — May 2026.
> **Scope:** Applies from v0.1 onward. Revisable on a phase boundary if a customer pilot surfaces a blocker.

## TL;DR

TAS supports two declarative, file-based agent formats starting in v0.1:

1. **[Pydantic AI `AgentSpec`](https://ai.pydantic.dev/docs/ai/core-concepts/agent-spec/)** (YAML or JSON) — the **canonical, primary** format. New starter templates, the v0.2 chat-to-PR authoring engine, and v0.3+ tooling target this format first.
2. **[Cargo AI](https://cargo-ai.org/) JSON** — supported as an **import path** and as a runnable format in its own right. Customers who already have Cargo AI agents do not need to convert them by hand to use TAS.

Everything else (LangGraph, OpenAI Agents SDK, Mastra, CrewAI, Vercel AI SDK, AutoGen, Semantic Kernel, etc.) is intentionally **not** a supported authoring format in v0.1. Code-defined agents may be runnable in later phases, but the v0.1 promise is single-file, declarative, diff-native.

## Why this matters

The root `README.md` makes four commitments that this decision has to honor:

1. Git is the system of record.
2. Every change is reviewable as a diff.
3. Adaptation is allowed; drift is governed.
4. Self-hostable first.

The v0.2 phase doc adds a fifth constraint that hits the format hardest: **non-engineers must be able to drive changes** through chat-to-PR, and **reviewers must be able to read the diff**. That single line eliminates most of the agent-framework landscape.

If the diff for "the customer-reply agent should also handle quote requests" is a non-trivial change to a Python state graph or a TypeScript module, a PM cannot review it and an EM cannot approve it on their phone. The format itself has to make that diff small and human-readable.

## What we evaluated

| Option | Format | Maturity | Diff-native? | Verdict |
| --- | --- | --- | --- | --- |
| **Pydantic AI `AgentSpec`** | YAML / JSON, single file, schema-validated | 17k stars, backed by Pydantic team, weekly releases | Yes | **Primary** |
| **Cargo AI** | Single JSON file, JSON Logic for branching, Rust runtime | ~4 stars, pre-1.0, single maintainer, MIT, local-first | Yes | **Supported import** |
| **LangGraph** | Python code (graph) | 32k stars, durable execution, LangSmith observability | No (code diff) | Not authored, possibly runnable later |
| **OpenAI Agents SDK** | Python code, sibling JS/TS | 26k stars, multi-provider, sandbox agents | No (code diff) | Not authored, possibly runnable later |
| **Mastra** | TypeScript code | 24k stars, Apache-2.0 with `ee/` source-available tier | No (code diff) | Not authored; license model also collides with the "self-hostable first" principle |
| **CrewAI** | YAML for agents + tasks, but a Python `crew.py` is required | 51k stars, standalone, strong community | Partial — orchestration is still code | Not authored |
| **Vercel AI SDK** | TypeScript primitives (`ToolLoopAgent`) | 24k stars, provider routing, great UI hooks | No | Building-block, not a format |
| **AutoGen / AG2** | Python | Microsoft Research, multi-agent conversation | No | Skip for v0.1 |
| **Semantic Kernel** | C# / Python / Java | Microsoft, .NET-leaning | No | Skip for v0.1 |
| **Google ADK** | Python, Google-cloud-flavored | Newer | No | Skip for v0.1 |
| **AGNTCY / draft agent-spec standards** | Spec | Pre-1.0, in flux | Not yet shippable | Track, do not adopt |

## Why Pydantic AI `AgentSpec` is the primary format

1. **It is genuinely declarative.** An agent is one YAML or JSON file containing `model`, `instructions`, `capabilities`, `output_schema`, `deps_schema`, and `model_settings`. `Agent.from_file('agent.yaml')` is the entire constructor. That is exactly the shape TAS needs to put into a Git repo and review as a diff.
2. **Schema-validated by design.** `deps_schema` and `output_schema` are real JSON Schemas. v0.4's governance phase is going to want exactly this kind of guardrail (a CI check can block diffs that break the contract before a human reviews them).
3. **Companion JSON Schema for editor autocompletion.** `AgentSpec.to_file()` emits a JSON Schema sidecar that the YAML Language Server picks up. v0.2's review UX gets autocomplete and inline validation in any modern editor for free.
4. **Model-agnostic out of the box.** OpenAI, Anthropic, Google, xAI, Bedrock, Cerebras, Cohere, Groq, Hugging Face, Mistral, Ollama, OpenRouter — plus a documented path for custom models. Cargo AI is currently OpenAI/Codex + Ollama. We need the broad coverage for early pilots.
5. **Observability is included.** `instrument: true` lights up Pydantic Logfire (OpenTelemetry under the hood). v0.3's per-agent operational dashboard becomes a configuration concern, not a build concern.
6. **MCP, A2A, durable execution, and evals all exist.** Each one maps directly to a later TAS phase (`MCP` → v0.5 corrections, `durable execution` → long-running v0.5+ workflows, `evals` → v0.4 governance signals).
7. **Maintainer signal is strong.** 17k stars, a clear backer (Pydantic Inc.), weekly-ish releases, used by the OpenAI SDK, Google ADK, Anthropic SDK, LangChain, LlamaIndex, CrewAI, and others for validation. The "what if this project goes away?" risk is low.
8. **Authoring is allowed to stay in code, too.** The same library supports code-defined agents. A customer who *does* want to author in Python gets the same runtime; their PR is just a `.py` diff instead of a `.yaml` diff. The format choice does not constrain power users.

## Why Cargo AI is supported, not dropped

1. **It is also genuinely declarative.** A Cargo AI agent is a single JSON file with `inputs`, `agent_schema`, `actions`, and `run`. The mental model overlaps heavily with `AgentSpec`, so a converter is a one-week mapping, not a rewrite.
2. **Honoring existing assets.** The original 0.1 plan referenced Cargo AI explicitly; some early customers may already have Cargo AI agents on disk. Forcing them to convert by hand to evaluate TAS is the wrong opening move.
3. **The "hatch to native binary" story is genuinely useful** for some self-hosted scenarios where the agent should ship as a single executable.
4. **JSON Logic in `actions[].logic` is reviewable** — a PM can read a condition like `{"==": [{"var": "needs_follow_up"}, true]}` without learning Python.
5. **Optionality is cheap here.** Importer + runner support is a small surface area. If Cargo AI's community grows, we are well-positioned. If it stalls, we have lost almost nothing.

## Why we did not lead with Cargo AI alone

This was the founder-preferred path on the way in, so it deserves an explicit answer.

- **Maturity.** ~4 GitHub stars, one maintainer (`analyzer1`), pre-1.0. A v0.1 customer asking "what happens if that project stops shipping?" has no good answer when it is our *only* supported format.
- **Ecosystem gaps.** No first-party MCP server library, no third-party tool registry, no built-in evaluators, no observability story beyond stdout. v0.3 and v0.4 would have to build all of that ourselves.
- **Hireability and recognition.** Almost no engineers have heard of Cargo AI. Customers comparing TAS against a CrewAI- or LangGraph-flavored competitor will pattern-match.
- **Authoring verbosity.** The Cargo AI JSON is structurally rich (`runtime_vars`, named inputs, JSON Logic actions), which is great for execution but verbose for "PM wants a 1-line tweak" diffs.
- **Bundling risk.** Tying TAS's format to a pre-1.0 third-party project ties our exit bar (`10 consecutive successful runs over a week`) to their stability. Pydantic AI on a recent release gives us a much shorter path to that bar.

## Why we did not pick a code-first framework

LangGraph, OpenAI Agents SDK, Mastra, and Vercel AI SDK are excellent runtimes. They are not a good fit for the **v0.2 chat-to-PR** authoring loop because:

- A non-engineer cannot read a Python state graph or a TypeScript module as a review.
- A coding agent producing diffs against complex code is more error-prone than producing diffs against a typed YAML schema.
- The "one file = one agent" mental model breaks down once an agent's behavior is spread across multiple modules, configs, and helper functions.

We expect to **run** code-defined agents eventually (the Pydantic AI library itself supports them), but authoring them in chat-to-PR is not a v0.1–v0.2 promise.

> **Update (v0.3+ direction):** The v0.1 framing above implicitly assumes "the reviewer is always a non-engineer," which the v0.2 PR policy already breaks — agents opted into YOLO auto-merge gate on CI, not human diff-reading. v0.3 captures the resulting direction: LangGraph, OpenAI Agents SDK, Mastra, CrewAI, and Pydantic AI's code mode become first-class **supported runtimes** (run history, dashboards, HITL, observability, and governance all parity), even though declarative remains the v0.1 starter. See the *Direction (v0.3+): Multi-framework agent runtime support* section in [`context/0.3/README.md`](../0.3/README.md) and [US-0.3-13](../0.3/USER_STORIES.md#us-03-13--run-a-code-defined-agent-langgraph--mastra--openai-agents-sdk--crewai).

## Why we did not pick CrewAI specifically

CrewAI's YAML covers role/goal/backstory/tasks, but the orchestration always lives in a Python `crew.py`. So changing an agent's *behavior* is usually a code change in practice, which puts it back in the "code-first" bucket above. The YAML-only surface is too thin for what TAS needs.

## What this means concretely for each phase

### v0.1 — Foundation
- Starter templates ship as Pydantic AI `AgentSpec` YAML.
- `import` flow accepts both Cargo AI JSON and Pydantic AI `AgentSpec` YAML/JSON.
- Both formats run successfully end-to-end.
- A documented converter exists (Cargo AI JSON → `AgentSpec` YAML). Customers can opt to convert on import or keep the original.

### v0.2 — Authoring velocity
- The Tembo coding agent produces `AgentSpec` YAML diffs as its primary output.
- For agents that originated as Cargo AI JSON, the coding agent edits them in-place in Cargo AI JSON (we do not auto-convert on edit; that would defeat the diff-readability point).
- Linters reject malformed specs against the JSON Schema sidecar before the human review.

### v0.3 — Operational surface
- `instrument: true` is the default for new `AgentSpec` agents; this drives the per-agent dashboard with no extra wiring.
- Per-agent operational dashboards read from Logfire / OpenTelemetry traces.
- Multi-framework support enters as a direction: LangGraph, OpenAI Agents SDK, Mastra, CrewAI, and Pydantic AI code mode become first-class supported *runtimes* (not starter formats) — see [v0.3 README, Direction section](../0.3/README.md) and [US-0.3-13](../0.3/USER_STORIES.md#us-03-13--run-a-code-defined-agent-langgraph--mastra--openai-agents-sdk--crewai).

### v0.4 — Governance depth
- `output_schema` and `deps_schema` deltas are first-class signals in the audit timeline ("schema-breaking change" gets its own badge).
- Eval suites (`pydantic_evals` or equivalent) can be referenced from the spec and run on PR.

### v0.5 — Adaptive intelligence
- Corrections-to-PR produce `AgentSpec` diffs by default (smallest, most reviewable surface).
- Variant proposals are new spec files, not branches inside a file.

### v0.6 — Mycelium
- Patterns are exchanged as `AgentSpec` fragments (typed, schema-validated, provenance-bearing), not as opaque blobs.

## Harness field (US-0.1-07)

TAS extends the standard Pydantic AI `AgentSpec` with a **required** `harness` field. The motivation comes straight from the user story: when an agent misbehaves, the triaging operator should be able to tell *at a glance* whether the problem is the prompt, the harness, or the model — without opening a ticket. Putting harness next to model in the agent definition makes the on-call's first instinct ("which knob moved?") a one-glance answer.

### Supported values

| Value | Label | Notes |
| --- | --- | --- |
| `claude-code` | Claude Code | Anthropic's coding-agent harness. The v0.1 starter default. |
| `opencode` | OpenCode | Open-source coding harness compatible with multiple model providers. |
| `pi` | Pi | Tembo's internal harness. |

Unrecognized harness values are rejected at PR/commit time by the validator in `web/src/lib/agent-format.ts` (the `HARNESSES` constant is the source of truth). A typo like `claude-codee` fails on the create-agent form, never at run time. Adding a new harness is a single code change plus a docs update — intentionally cheap, so the floor stays current with what customers actually use.

### Model field

`model` remains a free-form string. Different harnesses support different model sets and the mapping changes too often to bake into the schema. Documented examples per harness:

- `claude-code` — `anthropic:claude-sonnet-4-6`, `anthropic:claude-opus-4-6`.
- `opencode` — any provider URI the OpenCode runtime supports (`openai:gpt-4o`, `anthropic:claude-sonnet-4-6`, `groq:llama-3.3-70b`, …).
- `pi` — Tembo-hosted aliases (TBD; track in the format matrix doc as it stabilizes).

If a customer pilot blocks on per-harness model whitelisting, we can add CHECK-style enums in a follow-up; the current open-string approach trades some strictness for keeping new model releases self-serve.

### Where this surfaces

- The agent definition file itself (committed to Git like any other field).
- Agent list rows on the workspace home — both shown as visible Badges (harness in blue, model in purple).
- The per-agent detail page header — same badges, bigger.
- v0.3 dashboards / topology / failure-investigation surfaces will pivot on `harness` and `model` as first-class run-metadata facets.
- Changes to either go through the same review path as any other agent change (chat-to-PR in v0.2, direct PR otherwise) — never edited in a live console.

### Starter template default

The v0.1 starter ships with `harness: claude-code` + `model: anthropic:claude-sonnet-4-6`. This resolves the open question in [`context/0.1/README.md`](./README.md): a workspace-level default would shift the decision from per-agent to per-workspace, but most early pilots have heterogeneous agents and want to pick at create time. Starter defaults stay simple; the create-agent form's harness dropdown lets the author override.

## Open questions

- Should the v0.1 converter (Cargo AI JSON → `AgentSpec` YAML) be one-way only, or round-trippable? Lossless round-tripping is hard because the two formats have different action models (JSON Logic + run-steps vs. capabilities + tools).
- Do we ship a default observability backend in v0.1 (Logfire-compatible OTel collector) or wait for v0.3? Leaning: defer, but make `instrument: true` always work against any OTel endpoint the customer points us at.
- What is the right home for the JSON Schema sidecar in the workspace repo? `agents/.schemas/` is the current proposal — keeps it out of agent listings while staying versioned alongside the agents themselves.

## References

- [Pydantic AI `AgentSpec` docs](https://ai.pydantic.dev/docs/ai/core-concepts/agent-spec/)
- [Pydantic AI repository](https://github.com/pydantic/pydantic-ai)
- [Cargo AI homepage](https://cargo-ai.org/)
- [Cargo AI repository](https://github.com/analyzer1/cargo-ai)
- [LangGraph](https://github.com/langchain-ai/langgraph), [OpenAI Agents SDK](https://github.com/openai/openai-agents-python), [CrewAI](https://github.com/crewAIInc/crewAI), [Mastra](https://github.com/mastra-ai/mastra), [Vercel AI SDK](https://github.com/vercel/ai) — surveyed and not adopted as authoring formats for v0.1.
