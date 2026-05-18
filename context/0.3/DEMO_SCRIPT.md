# v0.3 Demo Script

**Target audience:** prospective customer's compliance/security stakeholder plus the engineering manager who already saw v0.2.
**Target duration:** 25–30 minutes.
**Goal of the demo:** prove that v0.3 closes the audit/HITL/ops gaps the v0.2 conversation surfaced — without slowing authoring.

## Pre-Demo Checklist (Off-Screen)

- Workspace already at v0.2 baseline, with **at least 3 recent PR-driven changes** to one agent (creates realistic changelog history).
- A `contract-redline` agent configured to enter a rich HITL step with a 3-field conditional form (category dropdown → conditional rationale → PDF upload).
- One known-failed run in the agent's history for the investigation segment.
- Org-level policy template `customer-facing-agents-require-review` already set; one workspace deviating from it (set up to demonstrate the override audit entry).
- Two browser users: an org admin and a reviewer.

## Flow (with rough timings)

### 1. 60-second recap of v0.2 (0:00 – 1:00)
**Say:**
> "Last time, we showed chat-to-PR authoring. Today, v0.3 is what happens *after* a few weeks of that — when your compliance team, your reviewers, and your support engineers all want different answers from the same system."

### 2. The changelog: who/when/why (1:00 – 7:00)
**Show:** the per-agent changelog view.
**Do:**
- Filter to "last 7 days".
- Click an event from a chat-authored PR → expand to show the chat session, the PR link, the reviewer, the merge time.
- Click an event from a policy change → show actor and justification.
- Click a HITL response event → show form fields submitted.

**Say:**
> "Every actor, every timestamp, every source — chat, PR, correction, human action, policy change — lands here. This is append-only at the storage layer. If something is wrong, we add a correction event; we don't rewrite history."

### 3. Rich HITL form in action (7:00 – 13:00)
**Do:** trigger a run on the `contract-redline` agent until it hits the HITL step.
**Show (reviewer view):** the conditional form.
- Pick category "Pricing dispute" → rationale field appears.
- Upload a PDF → preview renders inline.
- Try to submit without rationale → validation blocks.
- Submit successfully.

**Say:**
> "Pause/resume was right for v0.2. For real reviewer workflows — contracts, claims, escalations — you need this kind of structured capture. The submitted response lands in the changelog with the run."

### 4. Per-agent operational dashboard (13:00 – 19:00)
**Show:** the `contract-redline` agent dashboard.
**Do:**
- Point at 24h/7d/30d pass-fail rate.
- Open the "Top failure reasons" panel; show one cluster ("missing redline category metadata").
- Open the "Active human tasks" panel; show the one we just completed plus others.
- Click "see related changes" → jump to the changelog filtered to this 7-day window.

**Say:**
> "Workspace admins live here on a normal Monday. Support engineers live here during an incident. It's not a Datadog replacement; it's the triage surface for *this* agent."

### 5. Org-level RBAC and policy templates (19:00 – 24:00)
**Switch to:** the org admin user.
**Show:**
- The org settings → policy templates list.
- The "Customer-facing agents require review" template.
- The list of workspaces and which are deviating.
- Click the deviating workspace → show the override audit entry with its justification.

**Say:**
> "Org admins set defaults; workspace admins can override, but the override is a recorded event with a justification. RBAC is enforced at the API — viewer, operator, workspace admin, org admin. No UI-only safety nets."

**Do:** quickly switch to a viewer-role user; attempt to trigger a run; show the rejection.

### 6. Failure investigation (24:00 – 28:00)
**Show:** the dashboard's "Top failure reasons" → click one cluster.
**Do:**
- Open one failed run.
- Show the failure reason → last human action → last agent change (link to PR).
- Click "similar failures" → see two more from last week.
- File a runbook suggestion (creates a draft note, not a PR).

**Say:**
> "Day-two operations is where most agent platforms quietly lose customers. This is the surface that keeps your support team from escalating every incident to engineering."

### 7. Wrap and v0.4 pointer (28:00 – 30:00)
**Show:** the four-phase roadmap.
**Say:**
> "v0.3 makes everything explainable. v0.4 closes the loop in the other direction: when an end user corrects an output, we route that correction back into a PR — using the same changelog, the same review policy, the same dashboards you saw today."

## Live-Demo Failure Plan

| If… | Then say… |
| --- | --------- |
| The conditional field doesn't appear | "Worth poking at — there's a known caching quirk on conditional schemas; we have a one-line fix queued." Continue with a pre-recorded screenshot. |
| The dashboard is slow to update | "Sub-minute is the target, not the floor. Let me show you a refreshed view from a parallel run." |
| The override audit entry is missing | "Let me show you yesterday's — same shape, real data." |

## Success Criteria (Demo)

- A complete `who/when/why` story is shown end-to-end for at least one chat-authored change.
- The rich HITL form is completed live with at least one validation block and one upload preview.
- The per-agent dashboard is used to land on a real failure and reach a related change in three clicks or fewer.
- An RBAC denial is demonstrated live.

## Common Questions & Crisp Answers

- **"Is the changelog exportable?"** Per-agent JSON export at v0.3. Streaming to a SIEM is on the v0.4 open-questions list — bring your preferred destination to the pilot.
- **"What about role permissions outside the four built-ins?"** Custom roles deferred past v0.4 unless a customer blocks on it; the policy template + per-agent overrides cover most asks.
- **"Are file uploads scanned for malware?"** MIME and size limits at v0.3; AV scanning is in the pilot-feedback bucket. Workspace-scoped object storage uses the customer's encryption settings.
- **"How does this relate to v0.4 corrections?"** v0.4's corrections produce events that look identical in this changelog. You won't learn a new surface to audit them.
