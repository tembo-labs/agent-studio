# v0.2 User Stories

Format: Connextra (**As a** *role*, **I want** *capability*, **so that** *benefit*) with explicit **Acceptance Criteria**.

## Personas Referenced

- **Product Manager (PM)** — defines product behavior; rarely writes code.
- **Ops Lead** — owns day-to-day agent behavior tweaks.
- **Engineering Manager (EM)** — accountable for change quality; sets policy.
- **Operator** — runs scheduled workflows.
- **Support/Reviewer** — approves PRs from chat sessions.

---

## US-0.2-01 — Chat-to-create an agent

**As a** PM, **I want** to describe a new agent in a chat session and receive a PR with the scaffold, **so that** I can propose agent creation without writing JSON or asking an engineer.

**Acceptance Criteria**
- The chat session has a clear "this will open a PR — review the description first" affordance before submission.
- The opened PR contains a complete, valid agent definition plus a description of the chat intent.
- If the coding agent cannot complete the request, the chat thread and PR (if opened) both surface the same actionable failure message.

---

## US-0.2-02 — Chat-to-edit an existing agent

**As an** Ops Lead, **I want** to describe a behavior change to an existing agent in chat and receive a PR with the targeted diff, **so that** updates stay traceable and reviewable.

**Acceptance Criteria**
- The diff is targeted — unrelated fields are not reformatted or rewritten.
- The PR description quotes the chat request verbatim so reviewers see the original intent.
- A new chat session against the same agent shows the recent PR history as context.

---

## US-0.2-03 — Per-agent PR policy

**As an** EM, **I want** to set a PR policy per agent (review-required vs auto-merge on green CI), **so that** I can match automation speed to the agent's risk profile.

**Acceptance Criteria**
- Policy is editable in the agent's settings; the current policy is visible on the agent's main page.
- Auto-merge **only** fires when (a) policy permits AND (b) CI is green AND (c) any required reviews are satisfied.
- A workspace default exists; per-agent policy overrides it.
- An admin audit entry is created whenever a policy changes.

---

## US-0.2-04 — Workspace default policy

**As an** EM, **I want** to set a workspace-wide default PR policy, **so that** new agents inherit our org's risk posture without me having to remember to configure each one.

**Acceptance Criteria**
- A new agent created via chat or import picks up the workspace default at creation time.
- Changing the workspace default does **not** retroactively change existing agents' policies.
- The workspace default is shown in workspace settings with a one-line explanation of what it does.

---

## US-0.2-05 — Recurring schedules

**As an** Operator, **I want** to schedule an agent to run on a recurring cron expression, **so that** routine workflows execute without manual triggering.

**Acceptance Criteria**
- A schedule field on the agent accepts standard cron syntax with validation and a human-readable preview ("every weekday at 09:00 UTC").
- Disabling a schedule does not delete its history of past triggers.
- A scheduled trigger appears in the run list with a `trigger=schedule` indicator.

---

## US-0.2-06 — Basic HITL pause/resume

**As an** Operator, **I want** an agent to be able to pause for human input and resume from a simple UI, **so that** sensitive steps stay in human control.

**Acceptance Criteria**
- A paused run shows the pause prompt and a free-text response (or confirmation) action.
- Resumed runs continue from the same step with the human response available in run state.
- A paused run survives a TAS restart and remains pausable.
- Default auto-cancel for paused runs is 24h, configurable per agent.

---

## US-0.2-07 — Visibility into chat-driven changes

**As a** Support/Reviewer, **I want** the PR description to show the chat thread that produced it, **so that** I can review intent alongside the diff.

**Acceptance Criteria**
- The PR body contains the originating chat session, or a link to it in TAS, with the request quoted.
- The PR includes the agent's pre-change definition reference (commit SHA + path) for context.

---

## Stretch (Considered, Deferred)

- Rich HITL forms with conditional fields and uploads — explicitly v0.3.
- Behavioral diff or test-coverage signals on the PR — v0.3 open question.
- Cross-repo agent edits — past v0.4 unless a customer blocks on it.
