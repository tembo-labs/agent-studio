# Agent Format Decision (v0.1)

> **Status:** Accepted — May 2026. Supersedes the earlier "declarative-only" framing.
> **Scope:** Applies from v0.1 onward. Revisable on a phase boundary if a customer pilot surfaces a blocker.

## TL;DR

TAS supports **multiple agent formats** from v0.1. Two are first-class defaults; the rest are first-class supported:

| Tier | Format | Why this tier |
| --- | --- | --- |
| **Default (declarative)** | [Pydantic AI `AgentSpec`](https://ai.pydantic.dev/docs/ai/core-concepts/agent-spec/) (YAML / JSON) | Single-file, schema-validated, model-agnostic, broad ecosystem. Best fit for chat-to-PR authoring and for non-engineer reviewers when an org has those workflows turned on. |
| **Default (declarative)** | [Cargo AI](https://cargo-ai.org/) JSON | Single-file, runnable as a native binary, structurally similar to `AgentSpec`. Honors existing assets; useful when a customer wants the "hatch to executable" story. |
| **Supported (code)** | [LangGraph](https://github.com/langchain-ai/langgraph) (Python/TS) | Industry-standard for stateful, long-running, durable agents. Real customer need. |
| **Supported (code)** | [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) (Python + JS/TS) | Lightweight, multi-provider, growing fast, sandbox agents. Real customer need. |
| **Supported (code)** | [Mastra](https://github.com/mastra-ai/mastra) (TypeScript) | First-class for TS-shop customers, integrates with Next.js / React stacks the same way TAS's own UI does. |
| **Supported (code)** | [CrewAI](https://github.com/crewAIInc/crewAI) (Python + YAML) | Multi-agent orchestration with strong community traction. |
| **Track, do not adopt** | AGNTCY drafts, Semantic Kernel, Google ADK, AutoGen / AG2, Vercel AI SDK primitives | Either too early, too platform-coupled, or building blocks rather than complete agent formats. |

The change from the earlier draft: **complex agents will need custom code, and TAS should host that code, not push it out.** A senior engineer building a stateful multi-tool agent in LangGraph or a TS shop building one with Mastra is a customer we want, not one we tell to come back when we ship a declarative format that covers their case.

## What changed in this revision

The previous version of this ADR argued that all agents must be authored in a declarative YAML/JSON file, because the v0.2 chat-to-PR loop needs reviewers to read the diff. Two things break that argument:

1. **YOLO mode is real.** Per `context/0.2/`, organizations choose the trust level per agent: review-required for customer-facing, YOLO auto-merge on green CI for low-stakes internal automations. The "reviewer must read the diff" gate only applies to review-required mode. For an agent under development with YOLO on, the diff readability question is moot — CI is the gate, not a human.

2. **Production review applies to *any* artifact.** Once an agent ships to production, the org's review policy applies whether the file is YAML or Python. A senior engineer reviewing a LangGraph PR is doing the same governed thing as a PM reviewing an `AgentSpec` YAML PR; the artifact differs, the discipline doesn't.

So the right axis isn't "declarative vs code." The right axes are:

- **Lifecycle stage** — development (YOLO defaults allowed) vs production (review-required defaults, RBAC, audit signals).
- **Author skill** — a PM editing instructions vs a senior engineer wiring a custom tool chain.
- **Agent complexity** — a prompt-and-schema agent vs a stateful multi-tool durable workflow.

Different combinations want different formats. TAS's job is to host all of them under the same governance plane, not to legislate which one is "right."

## Why this matters

The root `README.md` operating principles still hold:

1. Git is the system of record.
2. Every change is reviewable as a diff.
3. Adaptation is allowed; drift is governed.
4. Self-hostable first.

None of these say the diff must be readable by a non-engineer. They say:

- The artifact must live in Git. **Code satisfies this.**
- Changes must be reviewable. **Code is reviewable — that's what code review is.**
- Governance applies to *every* change. **The policy engine doesn't care about format.**
- Self-hostability is about the control plane, not the agent runtime.

The previous ADR conflated "reviewable" with "reviewable by a non-engineer." That was wrong. The system supports both modes because the customer mix supports both modes.

## What we evaluated, restated

| Option | Format | Maturity | Best for | Tier |
| --- | --- | --- | --- | --- |
| **Pydantic AI `AgentSpec`** | YAML / JSON, single file, schema-validated | 17k stars, Pydantic team, weekly releases | Non-engineer authoring; chat-to-PR; broad provider mix; observability via Logfire/OTel | **Default** |
| **Cargo AI** | Single JSON file, JSON Logic actions, Rust runtime | ~4 stars, pre-1.0, MIT, local-first | Honoring existing assets; native-binary delivery; locally-runnable agents | **Default (secondary)** |
| **LangGraph** | Python (and LangGraph.js) — graph code | 32k stars, durable execution, LangSmith | Long-running stateful agents; durable HITL; agents that need fine-grained control over the graph | **Supported (code)** |
| **OpenAI Agents SDK** | Python + JS/TS, lightweight | 26k stars, multi-provider via LiteLLM/any-llm | Tool-heavy agents; sandbox agents that operate over a filesystem; teams already on OpenAI primitives | **Supported (code)** |
| **Mastra** | TypeScript, first-class workflows + memory | 24k stars, Apache-2.0 (with `ee/` enterprise tier) | TypeScript / Next.js shops; teams that want agents in the same repo as their web app | **Supported (code)** |
| **CrewAI** | Python + YAML | 51k stars, multi-agent orchestration | Role-based multi-agent crews; teams that find Crews + Flows the right mental model | **Supported (code)** |
| **Pydantic AI** (code mode) | Python | Same library as `AgentSpec` | A team that wants the same runtime as the declarative default but with type-safe Python authoring | **Supported (code)** |
| **Vercel AI SDK** | TypeScript primitives (`ToolLoopAgent`) | 24k stars | Not really a "format" — it's a building block for the other formats. Use as a runtime detail. | Track |
| **AutoGen / AG2** | Python | Microsoft Research | Multi-agent conversation research; not optimized for governed prod | Track, not adopt |
| **Semantic Kernel** | C# / Python / Java | Microsoft, .NET-leaning | Enterprise .NET shops; out of scope for first pilots | Track, not adopt |
| **Google ADK** | Python | Google-cloud-flavored, newer | Customers committed to Google Cloud | Track, not adopt |
| **AGNTCY / draft agent-spec standards** | Spec | Pre-1.0, in flux | Standardization candidate; revisit when it stabilizes | Track |

## Why Pydantic AI `AgentSpec` stays a default

1. **It is genuinely declarative.** An agent is one YAML or JSON file containing `model`, `instructions`, `capabilities`, `output_schema`, `deps_schema`, `model_settings`. `Agent.from_file('agent.yaml')` is the entire constructor.
2. **Schema-validated by design.** `deps_schema` and `output_schema` are real JSON Schemas. CI can reject diffs that break the contract before a human looks — useful in *every* mode, especially YOLO, where CI is the gate.
3. **Companion JSON Schema sidecar** powers editor autocompletion and inline validation. Cheap UX win for the v0.2 review surface.
4. **Model-agnostic.** OpenAI, Anthropic, Google, xAI, Bedrock, Cerebras, Cohere, Groq, Hugging Face, Mistral, Ollama, OpenRouter, plus a documented custom-model path.
5. **Observability included.** `instrument: true` lights up Pydantic Logfire / OTel. v0.3's per-agent dashboard becomes configuration, not engineering.
6. **MCP, A2A, durable execution, and evals all already exist** in the library. Each maps to a later TAS phase.
7. **Strong maintainer signal.** Pydantic Inc., weekly releases, used by every other major SDK for validation.
8. **Same runtime handles code mode.** A team that outgrows the declarative spec can drop into Python without changing runtimes.

## Why Cargo AI stays a default

1. **Genuinely declarative single file.** Mental model overlaps heavily with `AgentSpec`.
2. **Honoring existing assets.** Some early customers already have Cargo AI agents; forcing conversion is the wrong opening move.
3. **"Hatch to native binary" is genuinely useful** for self-hosted scenarios that want a single executable.
4. **JSON Logic** is reviewable plain text — a PM can read `{"==": [{"var": "needs_follow_up"}, true]}`.
5. **Optionality is cheap.** Importer + runner support is a small surface area.

We do not lead with *only* Cargo AI because of the maturity gap (one maintainer, pre-1.0, small ecosystem) and the narrower provider mix. Pairing it with Pydantic AI `AgentSpec` hedges that risk while keeping the Cargo AI story alive.

## Why we now actively support code-first frameworks

Three reasons, each grounded in something the v0.1–v0.6 docs already promise:

1. **Complexity ceiling.** Some agents need custom Python tools, complex state graphs, durable execution, or tight integration with a host application. A declarative format will never cover those well. Telling that customer "TAS isn't for you" defeats the goal of being the control plane for *agents*, plural.
2. **Lifecycle policy already handles risk.** v0.2 ships per-agent PR policy (review-required vs YOLO auto-merge) and v0.4 ships RBAC and policy templates. Those gate *all* changes, regardless of format. A LangGraph PR going through a review-required pipeline is exactly as governed as an `AgentSpec` PR.
3. **Real customer surfaces match real frameworks.** TS shops will ask for Mastra. Python teams committed to LangGraph won't switch. Teams that started on the OpenAI Agents SDK have working code. Supporting them costs us runtime adapters and per-format docs, not the architecture.

What "supported" means concretely:

- **Runtime:** TAS can execute the agent. For Python frameworks that means a Python runtime per workspace; for TS frameworks, a Node runtime. Containerized.
- **Git integration:** the agent's source — whether one YAML file or a Python module — lives in the workspace repo. PRs work the same way.
- **Run history + logs:** identical surface across formats.
- **Authoring path:** for code-defined agents, v0.2's chat-to-PR can still produce diffs against the code, but the human reviewer is expected to be an engineer.
- **Observability:** OTel-based, format-agnostic. Each framework's instrumentation is mapped to the same trace surface.

What "supported" does **not** mean in v0.1:

- We don't ship a starter template for every framework on day one. Pydantic AI `AgentSpec` + Cargo AI ship as starters in v0.1. LangGraph / OpenAI Agents SDK / Mastra / CrewAI starters are scheduled across v0.1–v0.3 based on pilot demand.
- We don't promise feature parity across all formats from day one. The format-specific feature matrix is tracked in a separate doc (TBD: `context/0.1/AGENT_FORMAT_MATRIX.md`).

## Development vs production: the actual gating model

This is the framing the previous ADR was missing. Borrowing the v0.2 doc's vocabulary:

| Stage | Default PR policy | Diff readability concern? | Authoring guidance |
| --- | --- | --- | --- |
| **Development** | YOLO auto-merge on green CI (opt-in per agent) | Low — CI is the gate. A senior engineer's Python change merging automatically while they iterate is fine. | Any supported format is fine. Pick what fits the agent. |
| **Promotion to production** | Review-required + RBAC enforced. Schema and behavioral signals (v0.4) surface on the PR. | High — the reviewer needs to understand the change. | A non-engineer reviewer means a declarative format diff is easier; an engineering reviewer can review any format. The policy says *who reviews*, not *what format*. |
| **Production** | Review-required. Auto-merge available only for tightly-scoped changes (e.g., prompt-only edits flagged by the schema-diff analyzer in v0.4). | High. | Same as promotion: format follows author and reviewer, not the other way around. |

This matches what `context/0.2/README.md` already says and what `context/0.4/` (governance) is building toward. The format choice is *not* the governance lever; the policy engine is.

## What this means concretely for each phase

### v0.1 — Foundation
- Ship two declarative starters: Pydantic AI `AgentSpec` YAML (canonical) and Cargo AI JSON (alternate).
- Ship a runtime path for at least one code-defined framework — most likely Pydantic AI's Python mode or OpenAI Agents SDK, picked by which is easier to containerize cleanly. This proves the "code is supported" promise without making us ship all four frameworks at once.
- `import` accepts: Pydantic AI YAML/JSON, Cargo AI JSON, and a recognized Python or TypeScript agent module path within the repo.

### v0.2 — Authoring velocity
- Chat-to-PR generates diffs in the agent's native format. Declarative formats produce small, readable diffs by default; code-defined formats produce code diffs.
- PR policy (review-required vs YOLO) is per-agent. YOLO is allowed during development and explicitly *not* the recommended default for production-tagged agents.
- For code-defined agents, the chat-to-PR engine can refuse to produce a change it isn't confident about and surface that to the human, rather than ship a broken diff.

### v0.3 — Operational surface
- Per-agent dashboards work across formats via OTel.
- HITL pause/resume works across formats (frameworks like LangGraph have native HITL; we adapt to a shared interface).

### v0.4 — Governance depth
- Audit timeline records changes uniformly across formats.
- "Schema-breaking change" is one badge among several; "code change in critical path" gets its own badge.
- RBAC + policy templates enforce review-required on production-tagged agents regardless of format.

### v0.5 — Adaptive intelligence
- Corrections produce diffs in the agent's native format. For declarative formats this is a YAML diff; for code formats this is a code diff that an engineer reviews.
- Variant proposals work across formats — a variant is a new file (declarative) or a new module (code).

### v0.6 — Mycelium
- Shared patterns travel in a format-agnostic envelope. Patterns derived from declarative agents land as declarative fragments; patterns derived from code agents land as code fragments or trait/interface descriptions.

## Open questions

- **Which code framework do we ship as the v0.1 runtime first?** Pydantic AI's code mode (same library as the declarative default) is the cheapest path. OpenAI Agents SDK is the most popular among Python teams. LangGraph is the most demanded for stateful agents. Sequencing decision deferred to first pilot signal.
- **What's the policy default for a freshly-created agent in v0.2?** Likely YOLO during a dev window, then auto-promoted to review-required when tagged production. Specific mechanics deferred to v0.2 grooming.
- **Where does the format-specific feature matrix live?** Proposed: a follow-up `context/0.1/AGENT_FORMAT_MATRIX.md` once we've shipped two formats end-to-end and learned what differs.
- **Cargo AI ↔ `AgentSpec` converter:** still on the table; lossless round-tripping is hard because the action models differ. One-way (Cargo AI JSON → `AgentSpec` YAML on user request) is the realistic v0.1 target.
- **Observability backend in v0.1:** still leaning defer, but `instrument: true` works against any OTel endpoint the customer points us at.

## References

- [Pydantic AI `AgentSpec` docs](https://ai.pydantic.dev/docs/ai/core-concepts/agent-spec/) — primary declarative default
- [Pydantic AI repository](https://github.com/pydantic/pydantic-ai)
- [Cargo AI homepage](https://cargo-ai.org/) — secondary declarative default
- [Cargo AI repository](https://github.com/analyzer1/cargo-ai)
- [LangGraph](https://github.com/langchain-ai/langgraph) — supported code-defined framework
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) — supported code-defined framework
- [Mastra](https://github.com/mastra-ai/mastra) — supported code-defined framework (TypeScript)
- [CrewAI](https://github.com/crewAIInc/crewAI) — supported code-defined framework
- [Vercel AI SDK](https://github.com/vercel/ai) — surveyed; treated as a building block, not a format
- `context/0.2/README.md` — PR policy modes (review-required vs YOLO) that this ADR builds on
- `context/0.4/README.md` — governance and RBAC that production-tag agents inherit
