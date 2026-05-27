# v0.3 Demo Script

**Target audience:** prospective customer's operations/reviewer stakeholder plus the engineering manager who already saw v0.2.
**Target duration:** 18–22 minutes.
**Goal of the demo:** prove that v0.3 closes the HITL and operational-visibility gaps the v0.2 conversation surfaced — without slowing authoring. Audit, RBAC, and policy templates are a separate conversation, demoed in [v0.4](../../0.4/DEMO_SCRIPT.md).

## Pre-Demo Checklist (Off-Screen)

- Workspace already at v0.2 baseline.
- A `contract-redline` agent configured to enter a rich HITL step with a 3-field conditional form (category dropdown → conditional rationale → PDF upload).
- One known-failed run in the agent's history for the investigation segment.
- At least one operator user.

## Flow (with rough timings)

### 1. 60-second recap of v0.2 (0:00 – 1:00)
**Say:**
> "Last time, we showed chat-to-PR authoring. Today, v0.3 is what happens when the people *running* those agents day to day — your reviewers, your workspace admins, the engineer who gets paged Sunday morning — need real tools, not log spelunking."

### 2. Rich HITL form in action (1:00 – 8:00)
**Do:** trigger a run on the `contract-redline` agent until it hits the HITL step.
**Show (reviewer view):** the conditional form.
- Pick category "Pricing dispute" → rationale field appears.
- Upload a PDF → preview renders inline.
- Try to submit without rationale → validation blocks.
- Submit successfully.

**Say:**
> "Pause/resume was right for v0.2. For real reviewer workflows — contracts, claims, escalations — you need this kind of structured capture. The submitted response is persisted as a structured event with the run; v0.4 will put that event under audit and access control."

### 3. Per-agent operational dashboard (8:00 – 14:00)
**Show:** the `contract-redline` agent dashboard.
**Do:**
- Point at 24h/7d/30d pass-fail rate.
- Open the "Top failure reasons" panel; show one cluster ("missing redline category metadata").
- Open the "Active human tasks" panel; show the one we just completed plus others.
- Click into a recent change to land on the originating PR.

**Say:**
> "Workspace admins live here on a normal Monday. Support engineers live here during an incident. It's not a Datadog replacement; it's the triage surface for *this* agent."

### 4. Failure investigation (14:00 – 19:00)
**Show:** the dashboard's "Top failure reasons" → click one cluster.
**Do:**
- Open one failed run.
- Show the failure reason → last human action → last agent change (link to PR).
- Click "similar failures" → see two more from last week.
- File a runbook suggestion (creates a draft note, not a PR).

**Say:**
> "Day-two operations is where most agent platforms quietly lose customers. This is the surface that keeps your support team from escalating every incident to engineering."

### 5. Wrap and v0.4 pointer (19:00 – 22:00)
**Show:** the six-phase roadmap with 0.1–0.3 marked.
**Say:**
> "v0.3 is the operator's floor. v0.4 puts every event you just saw — the HITL response, the change link, the run completion — under an immutable audit trail with role-based access. Same data, governance layer on top."

## Live-Demo Failure Plan

| If… | Then say… |
| --- | --------- |
| The conditional field doesn't appear | "Worth poking at — there's a known caching quirk on conditional schemas; we have a one-line fix queued." Continue with a pre-recorded screenshot. |
| The dashboard is slow to update | "Sub-minute is the target, not the floor. Let me show you a refreshed view from a parallel run." |

## Success Criteria (Demo)

- The rich HITL form is completed live with at least one validation block and one upload preview.
- The per-agent dashboard is used to land on a real failure and reach a related change in three clicks or fewer.
- The audience leaves understanding the v0.3 / v0.4 split — operations vs. governance.

## Common Questions & Crisp Answers

- **"Where's the audit trail?"** v0.4. v0.3 produces the structured events; v0.4 puts them under audit and access control. Same data, governance layer on top.
- **"Are file uploads scanned for malware?"** MIME and size limits at v0.3; AV scanning is in the pilot-feedback bucket. Workspace-scoped object storage uses the customer's encryption settings.
- **"How does this relate to v0.5 corrections?"** v0.5's corrections produce events that look identical in the dashboard and the v0.4 changelog. You won't learn a new surface to operate them.
- **"Can we customize dashboard widgets?"** Built-ins only in v0.3. Custom widgets are in the pilot-feedback bucket pending real demand.
