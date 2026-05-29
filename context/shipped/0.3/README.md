# Tembo Agent Studio v0.3 — Operational Surface

> **Headline:** Fast authoring is only half the job. v0.3 is the day-to-day operating surface — rich human-in-the-loop forms for reviewers, and per-agent dashboards for the operator who gets paged when something breaks.
>
> **Audience:** workspace admins, operators, reviewers, and the first-line support engineers who absorb the 2am pages.

## Problem

After v0.2, customers are shipping changes in minutes instead of weeks. That speed exposes two operating gaps that aren't about *making* changes — they're about *running* the system day to day:

- **HITL is too crude.** Free-text pause/resume works for a quoting workflow but not for a reviewer who needs to upload a signed PDF, pick from a conditional dropdown, and confirm a structured summary.
- **Per-agent operational visibility is absent.** When an agent misbehaves, support engineers cobble together a story from raw run logs and Slack screenshots.

Without these, the v0.2 authoring win is real but the operator experience around it stays brittle. (Audit, RBAC, and org-level policy are a separate trust conversation — addressed in [v0.4 (Governance depth)](../0.4/).)

## Our Solution

v0.3 is the operational-surface release. It adds five interlocking capabilities, all targeted at *day two*:

1. **HITL pause/resume + rich forms.** Agents can pause for human input on a step; a UI lets a human resume with a structured response. The form layer supports multi-field structure, conditional logic, file uploads, image/PDF preview, validation, and structured response persistence — plus a set of pre-built archetypes for the workflows we actually see (email, deal review, social outreach, scheduling, content approval). *Pause/resume was originally [v0.2 US-06](../0.2/USER_STORIES.md#us-02-06--basic-hitl-pauseresume-moved-to-v03); moved here so we ship one cohesive HITL story instead of a basic v0.2 surface that v0.3 immediately replaces.*
2. **Per-agent operational dashboards.** Run history, revision history, active human tasks, error trends, and SLA-relevant counters per agent — built so that triage starts on one screen, not in raw logs.
3. **Workspace-wide triage surfaces.** A growth dashboard, an agent inventory, a tasks inbox, a topology map, and a log explorer — all scoped to the workspace, all reading from the same source of truth as the per-agent views.
4. **Connections + event triggers.** A generic OAuth + token-storage framework so an agent can read from / write to third-party systems (Gmail, Slack, Notion, GitHub) — plus event-driven triggers (webhook receivers with signature verification) so agents fire on real activity, not just a cron. *Originally [v0.2 US-08](../0.2/USER_STORIES.md#us-02-08--event-driven-trigger-moved-to-v03); moved here because event triggers depend on the Connections substrate.*
5. **A per-agent chat configuration entry point.** The v0.2 chat-to-PR loop is reachable from every agent's detail page, with the agent identity already in context.
6. **Failure investigation in three clicks.** A failed run reaches its triggering revision, the most recent human action, and similar past failures without leaving the page.

## Shipped

> **Status:** Shipped May 2026. The list below diverges from the
> original "What Ships in v0.3" plan below because Connections turned
> out to be a substrate-shaped piece of work that ate the phase, and
> HITL — the original v0.3 anchor — moved to v0.4 in its place. The
> plan stays documented as written so future readers can see what
> shifted.

- **Composio-backed Connections substrate.** ~1,043-toolkit
  catalog (Slack, Gmail, Google Sheets, Notion, GitHub, etc.)
  authorized per-user-per-workspace via Composio's hosted OAuth.
  Agent specs reference connections by `(toolkit, name)` slot;
  the canonical form is named slot + narrow tools list. Connections
  is a top-level sidenav surface (separate from Settings).
- **Per-agent operational dashboard.** Health header, four
  stat tiles (Runs / Success rate / Spend / Avg duration over
  30d), daily-trend bar with success / failure overlay, top-5
  grouped failure prefixes with links to example runs.
- **Pydantic-AI runtime pipe.** Python wrapper materializes a
  Composio session from the spec's `connections:` field and
  attaches it to the agent as an MCP toolset.
- **Persisted run cost.** `run.cost_usd` populated at
  `mark_succeeded` time; Cost column on the Runs page with
  bar-chart visualization.
- **Multi-workspace.** Sidebar switcher, last-visited workspace
  landing, automation "Run as" owner picker for the per-user
  connections model.
- **Sidebar action-needed alerts.** "Connect {toolkit} for
  {agent}" when a repo agent declares a slot the current user
  hasn't authorized.
- **Event triggers (Composio webhooks).** Per-agent Triggers
  section binds a Composio trigger instance (Gmail new message,
  Slack new mention, GitHub PR opened, …) to an agent + owning
  user + connection slot. Per-workspace webhook endpoint
  HMAC-verifies the inbound payload and queues a run with
  `trigger='event'`. Event runs show a purple **Event** badge.
- **Agent inventory.** Workspace landing page is a sortable
  table with facet pills (Active / Idle / Error / Pending /
  Invalid) and free-text search, replacing the card grid.
- **Workspace dashboard.** Mirrors the per-agent dashboard
  shape: health header, four stat tiles, 30-day trend bar,
  top-failing-agents rollup. Improvements counts + recent
  list stay below as secondary context.
- **Log explorer.** `/runs` search now hits `error_message`
  alongside input/output; failed rows surface their error text
  inline; filters are URL-driven so deep links land prefiltered.
- **Failure-aware sidebar.** "Action needed" rail surfaces
  agents that failed in the last 24h alongside the
  missing-connection alerts.
- **Failure investigation links.** Failed-run detail page
  offers "Find similar runs →" (deep-linked /runs filter) and
  "View {agent} failure groups →" (anchored deep link into
  the per-agent dashboard).

## Deferred from the v0.3 plan (→ v0.4)

- **HITL pause/resume + rich forms** — originally the v0.3
  anchor; the Connections substrate ate the phase and the
  remaining triage work landed in its place. HITL is the next
  major substrate piece and anchors v0.4.
- **Topology map + tasks inbox** — the workspace-wide cousins
  to the inventory/dashboard that didn't fit; tasks inbox
  depends on HITL anyway.

## What Ships in v0.3 (original plan)

- **Form schema renderer.** Conditional field visibility, file upload with size and MIME limits, image/PDF preview, required-field validation.
- **Rich HITL task archetypes.** Pre-built form templates for email, deal review, social outreach, scheduling, and content approval — all renderable from the schema DSL.
- **Operational dashboards.** Per-agent: run pass/fail rate, time-to-resolution on HITL tasks, top failure reasons, list of active human-blocked steps. Workspace-wide: agent onboarding and run-volume growth with configurable time spans.
- **Agent inventory + topology map + tasks inbox + log explorer.** Workspace-scoped triage surfaces that share the agent state model — no separate "map config" or "inbox config" to drift.
- **Failure investigation surface.** From a failed run, surface the last human action, the most recent agent change, and similar past failures — without leaving the page.
- **Per-agent chat configuration modal.** The v0.2 chat-to-PR authoring loop is launchable from every agent's detail page, with the agent already in context.
- **Connections framework.** Data-driven OAuth: each provider declared in `connections/*.yaml` in the workspace repo (authorize URL, token URL, scopes, client-id/secret env names, MCP server URL). Generic OAuth 2.0 + PKCE flow handles authorize → callback → token + refresh-token storage encrypted in `workspace_secret`. A small set of named handlers (`google`, `slack`, `microsoft`) covers the non-standard outliers.
- **Event triggers.** A webhook receiver at `/api/hooks/:workspace/:connection` with HMAC-SHA256 signature verification using a per-workspace secret. An agent's automation row gains `trigger_kind = 'event'` plus an event filter (event source + filter expression). A run fired from an event lands with `trigger='event'` and a link back to the originating payload.

> **Note (2026-05-26):** The Connections shape actually shipped is
> Composio-backed, not the TAS-owned OAuth-per-provider framework
> described above. The TAS-owned substrate was prototyped first and
> lives dormant in the codebase (`lib/connections.ts`,
> `lib/oauth-state.ts`, `api/connections/{slack,google}/*`) for a
> potential v0.4 "advanced mode." Composio won on time-to-ship and
> catalog breadth (~1,043 toolkits vs hand-registering OAuth apps
> per provider).

## Out of Scope for v0.3

- Immutable `who/when/why` changelog, RBAC, and org-level policy templates — [v0.4 (Governance depth)](../0.4/).
- Correction-to-code learning, variant lifecycle — [v0.5 (Adaptive intelligence)](../../0.5/).
- Cross-deployment shared learning — [v0.6 (Mycelium)](../../0.6/).

## Strategy

Get the operator experience right *before* layering governance and adaptive loops on top. A reviewer who can't upload a PDF or an oncall who can't read run health on one screen will not care that the platform has a clean audit story. The v0.4 governance work depends on v0.3 forms and dashboards producing structured events worth auditing.

## Direction (v0.3+): Multi-framework agent runtime support

> **Status:** Direction, not exit-bar. Concrete delivery is paced by pilot demand, not pinned to the v0.3 release.

[v0.1's `AGENT_FORMAT.md`](../0.1/AGENT_FORMAT.md) intentionally limited the supported authoring formats to single-file declarative specs (Pydantic AI `AgentSpec` and Cargo AI JSON), on the grounds that the v0.2 chat-to-PR loop needs diffs a non-engineer can read. That constraint was right for v0.1, but it does not extend to every agent forever:

- **YOLO mode breaks the universal-diff-readability premise.** [v0.2's PR policy](../0.2/) already lets organizations opt individual agents into auto-merge on green CI. For an agent under YOLO, the gate is CI, not human review — so the format does not need to be approachable for a non-engineer.
- **Production review applies regardless of format.** Once an agent ships to production, [v0.4](../0.4/)'s RBAC + policy templates gate every change. A senior engineer reviewing a LangGraph PR is doing the same governed thing as a PM reviewing an `AgentSpec` YAML PR; the policy engine is the lever, not the format.
- **Complex agents need code.** Stateful multi-tool workflows, durable execution, and tight host-app integration outgrow a declarative spec. Telling a customer with a working LangGraph or Mastra agent "TAS isn't for you" defeats the goal of being *the* control plane for agents, plural.

Starting in v0.3+, TAS expands the set of **runtimes** it can host while keeping a small, opinionated default for **authoring starters**. The candidate first-class supported runtimes:

| Runtime | Language | Why included |
| --- | --- | --- |
| [LangGraph](https://github.com/langchain-ai/langgraph) | Python (and LangGraph.js) | Industry-standard for stateful, durable, long-running agents. |
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | Python + JS/TS | Lightweight, multi-provider via LiteLLM/any-llm; sandbox-friendly. |
| [Mastra](https://github.com/mastra-ai/mastra) | TypeScript | Native fit for TS shops; agents live alongside Next.js / React app code. |
| [CrewAI](https://github.com/crewAIInc/crewAI) | Python + YAML | Role-based multi-agent crews with strong community traction. |
| Pydantic AI (code mode) | Python | Same runtime as the declarative default, but type-safe Python authoring. |

"Supported" means concretely:

- **Runtime:** TAS can execute the agent. Containerized Python or Node runtime per workspace.
- **Git integration:** the agent's source — whether one YAML file or a Python module — lives in the workspace repo. PRs work the same way.
- **Run history + logs:** identical surface across formats. v0.3's per-agent dashboards stay format-agnostic.
- **Authoring path:** [v0.2](../0.2/)'s chat-to-PR loop continues to produce diffs against the code, but the reviewer is expected to be an engineer when the artifact is code.
- **Observability:** OTel-based and format-agnostic. Each framework's instrumentation maps to the same trace surface.

What this is **not**:

- Not a promise that every framework above ships a starter template on day one of v0.3. Pydantic AI `AgentSpec` + Cargo AI remain the v0.1 starters. Other framework starters roll out across v0.3–v0.6 based on pilot demand.
- Not a relaxation of governance. The policy engine still gates everything that reaches production.
- Not feature parity across all formats from day one. The format-specific feature matrix is tracked separately (TBD: `context/0.3/AGENT_FORMAT_MATRIX.md`).

This direction is captured here rather than in [v0.1's AGENT_FORMAT.md](../0.1/AGENT_FORMAT.md) because adding framework runtimes is a v0.3+ operational concern, not a v0.1 foundation concern. The v0.1 doc is updated with a forward-pointer so the trade-off is visible to anyone reading it.

## Technical Details

- **Form schema.** JSON Schema-based, with conditional visibility expressed as a small DSL. Uploaded files are stored in workspace-scoped object storage with the workspace's encryption settings.
- **Dashboards.** Read models built off the run store; no shared data with v0.2's PR surface.
- **Failure investigation.** Cross-reference HITL response store, run store, and PR metadata. No new persistence layer beyond what runs and forms already produce.

## Customer Quote (Drafted)

> "Our reviewers stopped opening tickets to ask 'where do I upload the redlined PDF?' the week v0.3 landed. The dashboard answered our oncall's first three questions on a real Sunday incident before they'd opened Slack."
>
> — *Head of Operations, regulated B2C platform (draft persona)*

## FAQ

### Why isn't multi-framework support in v0.3's exit bar?
Because v0.3's job is the operator experience — forms, dashboards, triage. Bolting "host four new runtimes" onto that release doubles the surface area and dilutes both. The Direction section above captures the commitment in main so the team can plan against it; concrete framework support lands when a pilot needs it, and the v0.3 exit bar stays focused on the operator surface.

### Why isn't audit in v0.3?
Because the audit conversation is fundamentally a *governance* conversation — RBAC, policy templates, org-level inheritance — and bundling it with reviewer forms and dashboards muddies both. v0.3 is what an operator needs to do their job; v0.4 is what an auditor needs to do theirs.

### What if a HITL form needs a field type we don't support yet?
v0.3 covers text, number, enum/dropdown, date, file, structured-confirmation. Anything outside that should be raised as feedback — we'd rather ship the right ten field types than thirty half-broken ones.

### Are dashboards real-time?
Sub-minute latency for active human tasks and run state. Daily rollups for trend dashboards. We're not building a Datadog replacement.

### How does v0.3 interact with the v0.4 changelog?
HITL form responses and dashboard-visible state changes will be the *raw events* the v0.4 changelog renders. v0.3 produces the structured events; v0.4 puts them under audit and access control.

## Exit Bar (Definition of Done for v0.3)

- [ ] A rich HITL form with at least one upload, one conditional field, and one validation rule is in production use at a pilot customer.
- [ ] At least one customer's first-line support team is using the per-agent dashboard as a primary triage surface.
- [ ] A failed run page reaches the most recent agent change and the most recent human action in three clicks or fewer.

## Open Questions Before v0.4

- Which structured events from v0.3 forms and dashboards should be first-class objects in the v0.4 changelog versus rolled-up summaries?
- Should the failure-investigation links from v0.3 also resolve into changelog filters, or live alongside?
- What's the right form field type to defer to v0.4 because it's actually a policy/permissions question (e.g., "this field is editable only by org admins")?
- The mockup surfaces a global growth dashboard, agent topology map, and workspace-wide log explorer — should these be **per-workspace** in v0.3, or are some of them inherently **org-level** and therefore properly v0.4 once RBAC lands?
- Tasks inbox assignment is currently modeled as `assignee = me | null`. Do we need group/team assignment (e.g., "any reviewer on the legal team") in v0.3, or wait for v0.4 RBAC roles to define groups before adding it?
- Task **priority** is a free-text high/medium/low in the mockup. Is priority an agent-defined property of the emitted task, a reviewer-editable field, or both?
- Task **due date** semantics: is "due" a soft SLA the inbox sorts by, or a hard deadline that affects auto-cancel / escalation behavior? (v0.2's HITL has a 24h auto-cancel default — how does that interact with a task carrying its own due date?)
- The topology map currently displays a single, derived view of source→agent→destination edges. Is the edge data computed from agent definitions, declared on the agent, or both? What is the source of truth?
- The mockup distinguishes **lightweight** agents (editable in-app) from heavyweight agents (repo-defined, "View Source"). v0.1 declared Git as the only source of truth — does v0.3 introduce an in-app definition store, or is "lightweight" just a UI affordance on top of the existing repo?
- Per-agent vs workspace-wide dashboards both ship in v0.3. If they disagree (e.g., per-agent success rate uses a 7d window but workspace dashboard uses 13w), which is canonical for incident response?
- Should the log explorer support persistent filters / saved queries in v0.3, or is that explicitly v0.4 alongside audit export?
- Five HITL task archetypes ship as templates in v0.3. What is the upgrade path when a customer needs a sixth — author a custom form schema, request a new archetype, or fall back to v0.2 free-text pause/resume?
- Which of the candidate multi-framework runtimes (LangGraph, OpenAI Agents SDK, Mastra, CrewAI, Pydantic AI code mode) lands first, and what is the trigger — a specific pilot, a stars-of-Tembo signal, or an explicit RFC?
- For code-defined agents under YOLO, what's the minimum CI signal we require before auto-merge — green tests only, or also a schema-shape check / eval-suite pass?
