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

## Stretch (Considered, Deferred)

- Run scheduling — pushed to v0.2.
- Multi-repo per workspace — pushed past v0.4 unless a customer blocks on it.
- Agent definition editor in-app — explicitly deferred; v0.2 introduces chat-to-PR, which is the right authoring surface.
