# v0.3 User Stories

Format: Connextra (**As a** *role*, **I want** *capability*, **so that** *benefit*) with explicit **Acceptance Criteria**.

## Personas Referenced

- **Reviewer** — completes HITL approvals; often a domain expert (legal, finance).
- **Workspace Admin** — runs one team's TAS workspace.
- **Support Engineer** — first-line incident response.

Governance personas (Compliance Stakeholder, Org Admin) live in [v0.4 (Governance depth)](../0.4/).

---

## US-0.3-01 — Rich HITL forms

**As a** Reviewer, **I want** HITL forms with multi-field structure, conditional visibility, file upload with preview, and field-level validation, **so that** approvals and structured data entry are accurate and efficient.

**Acceptance Criteria**
- Supported field types: text, number, enum/dropdown, date, file (with MIME and size limits), structured-confirmation.
- Conditional visibility expressible without writing code (small DSL in the form schema).
- Image and PDF uploads render an in-form preview.
- Validation errors block submit and are surfaced inline.
- Submitted responses are persisted with the run as structured events (the substrate v0.4's changelog will render).

---

## US-0.3-02 — Per-agent operational dashboard

**As a** Workspace Admin, **I want** a per-agent dashboard showing run health, active human tasks, recent changes, and top failure reasons, **so that** I can monitor reliability and operator workload without piecing it together from logs.

**Acceptance Criteria**
- Dashboard updates within one minute for active runs and human tasks.
- Run pass/fail rate is shown over 24h / 7d / 30d windows.
- Top failure reasons (clustered by error signature) are listed for the selected window.
- A link from the dashboard to the relevant run history exists for any time window.

---

## US-0.3-03 — Failure investigation

**As a** Support Engineer, **I want** to open a failed run and immediately see the associated human actions, recent agent changes, and similar past failures, **so that** I can diagnose issues without escalating to engineering by default.

**Acceptance Criteria**
- A failed run page shows: the failure reason, the last human action on this agent, the last agent change (with link to PR), and a "similar failures" link.
- A one-click action exists to file a runbook update suggestion (creates a draft note, not a PR).
- Common failure clusters (e.g., bad API key, rate-limited model) have explanatory text linked from the failure reason.

---

## Stretch (Considered, Deferred)

- AV scanning on file uploads — pilot-feedback bucket.
- Workspace-scoped data residency controls — out of scope until enterprise demand validates priority.
- Custom dashboard widgets per workspace — promising; gather pilot signal before promoting.
- Structured-event-level audit and access control — explicitly moved to [v0.4 (Governance depth)](../0.4/).
