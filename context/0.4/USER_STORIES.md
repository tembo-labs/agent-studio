# v0.4 User Stories

Format: Connextra (**As a** *role*, **I want** *capability*, **so that** *benefit*) with explicit **Acceptance Criteria**.

## Personas Referenced

- **Compliance Stakeholder** — owns audit responses; rarely uses the product daily.
- **Org Admin** — sets policy across many workspaces.
- **Workspace Admin** — runs one team's TAS workspace; inherits org policy and can tighten but not loosen.

Operator-surface personas (Reviewer, Support Engineer) live in [v0.3 (Operational surface)](../0.3/).

---

## US-0.4-01 — Immutable `who/when/why` changelog

**As a** Compliance Stakeholder, **I want** an immutable, append-only changelog of who changed what and why across agents, **so that** we can satisfy audit and incident review requirements without engineering escalation.

**Acceptance Criteria**
- Changelog records actor identity, timestamp, source (chat / PR / HITL response / dashboard event / correction / human action / policy change), target (agent or workspace), and a structured payload.
- Records are append-only; corrections are added as new events of `kind=correction` referencing the original.
- Per-agent view shows the agent's complete history. Per-workspace view shows cross-cutting policy and access events.
- Filterable by actor, time range, and source.
- The same v0.3 structured events (HITL submissions, dashboard-visible state changes) are first-class in the changelog without re-instrumentation.

---

## US-0.4-02 — RBAC

**As an** Org Admin, **I want** role-based access (org admin, workspace admin, operator, viewer) enforced at the API layer, **so that** teams can collaborate safely at scale without UI-only safety nets.

**Acceptance Criteria**
- Role assignments are themselves audited.
- A viewer cannot trigger runs, change policy, or approve PRs via API.
- An operator cannot change policy or RBAC settings via API.
- A workspace admin's actions are scoped to their workspaces; cross-workspace operations require org admin.
- API enforcement is verified by a deny-test in CI, not just the UI.

---

## US-0.4-03 — Org-level policy templates

> **Moved to [Backlog](../backlog/USER_STORIES.md#us-backlog-01--org-level-policy-templates) on 2026-05-27.** The other v0.4 stories landed without it. Pull forward when a concrete customer use case lands or when v0.5 prep needs the substrate.

---

## US-0.4-04 — Audit timeline export

**As a** Compliance Stakeholder, **I want** to export a filtered audit timeline (per-agent or per-workspace, time-bounded), **so that** I can feed it to our reporting pipeline or share it with auditors.

**Acceptance Criteria**
- JSON export at v0.4 is the supported path.
- Export honors RBAC: a viewer cannot export entries they could not see in the UI.
- Streaming to a SIEM is acknowledged as a v0.5 open question; pilot destinations welcome.

---

## US-0.4-05 — Policy and RBAC change history

**As an** Org Admin, **I want** policy template changes and role-assignment changes to be first-class entries in the changelog, **so that** governance-affecting changes are themselves governed.

**Acceptance Criteria**
- Policy template version changes appear in the changelog with a diff.
- Role assignment and revocation events appear with actor and target identity.
- Override events on inherited policies appear with the justification text.

---

## Stretch (Considered, Deferred)

- Custom RBAC roles beyond the four built-ins — post-v0.6 unless a customer blocks.
- Streaming the changelog to an external SIEM — v0.5 open question.
- Workspace-scoped data residency controls — out of scope until enterprise demand validates priority.
- Cryptographically signed audit entries (notarization) — promising; gather pilot demand before promoting.
