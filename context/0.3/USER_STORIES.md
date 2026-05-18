# v0.3 User Stories

Format: Connextra (**As a** *role*, **I want** *capability*, **so that** *benefit*) with explicit **Acceptance Criteria**.

## Personas Referenced

- **Compliance Stakeholder** — owns audit responses; rarely uses the product daily.
- **Reviewer** — completes HITL approvals; often a domain expert (legal, finance).
- **Workspace Admin** — runs one team's TAS workspace.
- **Org Admin** — sets policy across many workspaces.
- **Support Engineer** — first-line incident response.

---

## US-0.3-01 — Immutable `who/when/why` changelog

**As a** Compliance Stakeholder, **I want** an immutable, append-only changelog of who changed what and why across agents, **so that** we can satisfy audit and incident review requirements without engineering escalation.

**Acceptance Criteria**
- Changelog records actor identity, timestamp, source (chat / PR / correction / human action / policy change), target (agent or workspace), and a structured payload.
- Records are append-only; corrections are added as new events of `kind=correction` referencing the original.
- Per-agent view shows the agent's complete history. Per-workspace view shows cross-cutting policy and access events.
- Filterable by actor, time range, and source.

---

## US-0.3-02 — Rich HITL forms

**As a** Reviewer, **I want** HITL forms with multi-field structure, conditional visibility, file upload with preview, and field-level validation, **so that** approvals and structured data entry are accurate and efficient.

**Acceptance Criteria**
- Supported field types: text, number, enum/dropdown, date, file (with MIME and size limits), structured-confirmation.
- Conditional visibility expressible without writing code (small DSL in the form schema).
- Image and PDF uploads render an in-form preview.
- Validation errors block submit and are surfaced inline.
- Submitted responses are persisted with the run and appear in the changelog.

---

## US-0.3-03 — Per-agent operational dashboard

**As a** Workspace Admin, **I want** a per-agent dashboard showing run health, active human tasks, recent changes, and top failure reasons, **so that** I can monitor reliability and operator workload without piecing it together from logs.

**Acceptance Criteria**
- Dashboard updates within one minute for active runs and human tasks.
- Run pass/fail rate is shown over 24h / 7d / 30d windows.
- Top failure reasons (clustered by error signature) are listed for the selected window.
- A link from the dashboard to the relevant changelog filter exists for any time window.

---

## US-0.3-04 — RBAC

**As an** Org Admin, **I want** role-based access (org admin, workspace admin, operator, viewer) enforced at the API layer, **so that** teams can collaborate safely at scale without UI-only safety nets.

**Acceptance Criteria**
- Role assignments are themselves audited.
- A viewer cannot trigger runs, change policy, or approve PRs via API.
- An operator cannot change policy or RBAC settings via API.
- A workspace admin's actions are scoped to their workspaces; cross-workspace operations require org admin.

---

## US-0.3-05 — Org-level policy templates

**As an** Org Admin, **I want** to set org-level policy templates (e.g., "customer-facing agents require review") that workspaces inherit, **so that** I do not have to chase each workspace admin to enforce baseline rules.

**Acceptance Criteria**
- Workspaces inherit org defaults on creation.
- Overriding an inherited policy at the workspace level produces an audit event with a required justification field.
- A view at the org level shows which workspaces are deviating from defaults and why.

---

## US-0.3-06 — Failure investigation

**As a** Support Engineer, **I want** to open a failed run and immediately see the associated human actions, recent agent changes, and similar past failures, **so that** I can diagnose issues without escalating to engineering by default.

**Acceptance Criteria**
- A failed run page shows: the failure reason, the last human action on this agent, the last agent change (with link to PR), and a "similar failures" link.
- A one-click action exists to file a runbook update suggestion (creates a draft note, not a PR).
- Common failure clusters (e.g., bad API key, rate-limited model) have explanatory text linked from the failure reason.

---

## Stretch (Considered, Deferred)

- Custom RBAC roles beyond the four built-ins — post-v0.4 unless a customer blocks.
- Streaming the changelog to an external SIEM — v0.4 open question.
- Workspace-scoped data residency controls — out of scope until enterprise demand validates priority.
