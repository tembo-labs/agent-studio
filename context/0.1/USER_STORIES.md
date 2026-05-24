# v0.1 User Stories

Format: Connextra (**As a** _role_, **I want** _capability_, **so that** _benefit_) with explicit **Acceptance Criteria**.

## Personas Referenced

- **Platform Admin** — runs the TAS install; cares about deploy, upgrade, ops.
- **Security Lead** — gates the pilot; cares about auth, secrets, audit surface.
- **Workspace Admin** — sets up a team's workspace; cares about repo/API key wiring.
- **Operator** — day-to-day user; cares about running agents and reading results.

---

## US-0.1-01 — Self-hosted deploy

**As a** Platform Admin, **I want** to deploy TAS with Docker Compose, **so that** my team can run Agent Studio in our environment without depending on a vendor SaaS.

**Acceptance Criteria**

- A single `docker compose up` from the documented path brings TAS to a healthy state.
- Required environment variables are documented in one place with safe defaults.
- A failing health check produces a clear error pointing to the broken component (DB, API, frontend).

---

## US-0.1-02 — Identity via `better-auth`

**As a** Security Lead, **I want** TAS authentication to run through `better-auth` with adapter slots for our IdP, **so that** sign-in respects our existing identity policies (MFA, group-based access).

**Acceptance Criteria**

- `better-auth` is the only auth surface; no parallel admin backdoor.
- A documented adapter exists for at least one common IdP (Okta or Azure AD).
- A first-time user signing in via the IdP lands on the correct workspace selection screen.

---

## US-0.1-03 — Tembo API key per workspace

**As a** Workspace Admin, **I want** to configure a Tembo API access key on my workspace, **so that** TAS can invoke Tembo services on behalf of that workspace without sharing credentials across teams.

**Acceptance Criteria**

- API key is stored encrypted at rest.
- Key is scoped to the workspace; deleting the workspace deletes the key.
- The settings page never displays the full key after creation — only a masked preview and a "rotate" action.

---

## US-0.1-04 — Git repository connection at onboarding

**As a** Workspace Admin, **I want** to connect a GitHub repository during workspace onboarding, **so that** agent definitions are version-controlled from day one.

**Acceptance Criteria**

- Onboarding flow includes a "connect repo" step that cannot be skipped silently.
- The chosen repo is validated (TAS confirms it can read and write).
- Disconnect/reconnect flow exists and is documented.

---

## US-0.1-05 — Create or import a baseline agent

**As an** Operator, **I want** to create an agent from a starter template (Pydantic AI `AgentSpec` YAML by default) or import an existing Cargo AI JSON definition, **so that** I can run a first production-relevant workflow without authoring code from scratch.

**Acceptance Criteria**

- At least one starter template is available out of the box, in Pydantic AI `AgentSpec` YAML.
- Importing a Cargo AI JSON definition works and surfaces validation errors clearly (no silent failure).
- Importing a Pydantic AI `AgentSpec` YAML or JSON definition works and surfaces validation errors clearly (no silent failure).
- A created/imported agent shows up in the workspace agent list with a known status, regardless of which source format it was created from.

---

## US-0.1-06 — Manual run with status and logs

**As an** Operator, **I want** to trigger an agent run manually and watch status + tailing logs, **so that** I can validate setup before any wider rollout.

**Acceptance Criteria**

- A "Run now" action exists on every agent.
- Run status transitions are visible in real time: `queued → running → succeeded | failed`.
- A failed run shows the last N lines of output and a clear failure reason, not a stack trace.
- Run records persist after the run completes (no in-memory-only logs).

---

## US-0.1-07 — Framework and model as first-class agent fields

> **Reframed (May 2026).** An earlier draft made this story about `harness` (Claude Code / OpenCode / Pi). Once multiple agent **frameworks** (Pydantic AgentSpec, Cargo AI, and the v0.3+ direction in [`context/0.3/README.md`](../0.3/README.md)) entered the picture, framework became the more meaningful "what kind of agent is this" axis. Harness — the coding-agent runtime driving a flow — is a *different* concept and is deferred to v0.3+ when raw-coding-agent flows become first-class. See [`AGENT_FORMAT.md`](./AGENT_FORMAT.md#what-about-coding-agent-harness-claude-code--opencode--pi).

**As an** Operator, **I want** an agent's **framework** (e.g. Pydantic AgentSpec, Cargo AI) and **model** (e.g. claude-sonnet-4.6, gpt-4o) to be visible everywhere the agent is rendered, **so that** when an agent misbehaves I can tell at a glance whether the issue is the prompt, the framework choice, or the model — before opening a ticket.

**Acceptance Criteria**
- Both `framework` and `model` are surfaced on the agent definition (framework is computed from the parsed shape; model is a declared field) and rendered as visible badges on the agent list card, the agent detail page header, and any topology / dashboard view that lists agents.
- Changing framework or model goes through the same review path as any other agent definition change (chat-to-PR in v0.2, direct PR otherwise) — it is never edited in a live console.
- The framework and model values are part of the run metadata captured on every run record, so v0.3's failure investigation surface can pivot on them.
- The set of supported framework values is documented; an unrecognized framework (i.e. a file shape no parser recognizes) surfaces as an invalid agent on the list with a clear error, not as a silently-skipped file.

---

## Stretch (Considered, Deferred)

- Run scheduling — pushed to v0.2.
- Multi-repo per workspace — pushed past v0.4 unless a customer blocks on it.
- Agent definition editor in-app — explicitly deferred; v0.2 introduces chat-to-PR, which is the right authoring surface.
- A pre-populated "starter agent library" beyond the single starter template in [US-0.1-05](#us-01-05--create-or-import-a-baseline-agent) — open question; see v0.1 README.
- A visible distinction between "lightweight" (in-app editable) and "heavyweight" (repo-defined) agent representations — promising as a UI affordance, but conflicts with the v0.1 rule that Git is the only source of truth. See v0.1 README open questions.
