# v0.2 Demo Script

**Target audience:** prospective customer team — typically a PM, an EM, and an operator in the same room.
**Target duration:** 18–22 minutes.
**Goal of the demo:** convince the room that non-engineers can drive real change in minutes without giving up review.

## Pre-Demo Checklist (Off-Screen)

- TAS workspace already at v0.1 baseline (signed in, repo connected, API key in place).
- One pre-built `inbox-triage` agent already imported and known to run.
- A second tab open to the GitHub repo (for live PR viewing).
- Workspace PR policy default set to **review-required**.
- A second user account ready to play "the reviewer" if needed.

## Flow (with rough timings)

### 1. 30-second recap of v0.1 (0:00 – 0:30)
**Say:**
> "Quick context: this workspace is the result of v0.1 — deployed, signed in, repo connected, one agent running. Everything you're about to see is on top of that foundation."

### 2. Chat-to-create an agent (0:30 – 5:00)
**Show:** the workspace chat surface, with a "New agent" entry point.
**Do:** type:
> "Create an agent that summarizes our daily standup notes from `#eng-standup` in Slack and posts a one-paragraph digest to `#eng-leads` every weekday at 4pm UTC."

**Watch for:** the assistant clarifying anything ambiguous (Slack workspace, time zone). Walk through the clarification.

**Show:** the resulting PR in the second tab.

**Say:**
> "Notice three things in this PR. One: it's a real diff in your repo, not a SaaS console entry. Two: the description quotes the chat request verbatim — reviewers see the intent. Three: CODEOWNERS already triggered the right reviewer."

### 3. Review and merge under review-required policy (5:00 – 7:30)
**Do:** switch to the reviewer's view, approve, and merge.
**Say:**
> "Default policy in this workspace is review-required. There is no path that bypasses this for now — that's deliberate. Auto-merge is opt-in and we'll show it next."

### 4. Chat-to-edit an existing agent (7:30 – 11:00)
**Show:** chat with the `inbox-triage` agent.
**Do:** type:
> "Starting today, skip messages from `vendor1.com`, `vendor2.com`, and `vendor3.com` — they're noise."

**Show:** the resulting PR. Highlight that the diff only touches the allowlist file — no unrelated reformatting.

**Say:**
> "This is what 'targeted diff' means. We don't rewrite the agent every time someone makes a small tweak. Git history stays readable."

### 5. Switch to auto-merge for the right agent (11:00 – 13:30)
**Show:** the `inbox-triage` agent's settings.
**Do:** flip its policy to "Auto-merge on green CI". Briefly point at the audit log entry that just appeared.
**Say:**
> "We just flipped this **one** agent to auto-merge. The workspace default is still review-required. This per-agent control is what we hear loudest from regulated customers."

**Do:** approve the open PR's CI and watch auto-merge fire.

### 6. Add a recurring schedule (13:30 – 16:30)
**Show:** the agent's schedule tab.
**Do:** add `0 9 * * 1-5` (weekdays at 09:00 UTC). Confirm the human-readable preview.
**Say:**
> "Schedules go through the same execution path as manual runs. Trigger is just metadata."

### 7. Run, pause, resume (16:30 – 20:00)
**Do:** trigger a manual run on an agent that has a HITL step. Walk to the pause prompt.
**Show:** the pause UI on the operator's side.
**Do:** type the resume response. Watch the run continue.
**Say:**
> "This is the v0.2 HITL — pause/resume, plain text. v0.3 adds rich forms with conditional fields and uploads. For this customer's first use case, pause/resume is enough."

### 8. Wrap (20:00 – 22:00)
**Show:** the four-phase roadmap.
**Say:**
> "v0.2 is the velocity story. Two PRs in this demo — one from chat-to-create, one from chat-to-edit — neither required an engineer to touch JSON. v0.3 is the governance story on top of this loop, and v0.4 turns the loop end-to-end: corrections from end users become PRs the same way."

## Live-Demo Failure Plan

| If… | Then say… |
| --- | --------- |
| The coding agent produces an unusable PR | "Worth showing — this is the failure-mode message the chat surfaces. We'll iterate on the prompt and try again, just like a junior engineer would." |
| CI hangs | "I'll switch to a pre-recorded merge for this segment so we don't burn time on infrastructure." |
| The pause/resume run gets stuck | "Let me show you the previous resumed run — same flow." |

## Success Criteria (Demo)

- At least **two** PRs are produced live from chat in front of the audience.
- One agent's policy is visibly changed from review-required to auto-merge, with the audit trail shown.
- A scheduled trigger is created and a HITL pause/resume cycle completes.
- The audience leaves understanding the per-agent policy story — not just "TAS does PRs."

## Common Questions & Crisp Answers

- **"What if the chat assistant misunderstands?"** Same as with a junior engineer: review the diff before merge. That's the entire point of the PR.
- **"Can we use this with GitLab?"** GitHub at v0.2. GitLab/self-hosted Git is in v0.3's open questions — pilot feedback decides priority.
- **"Will this work without an internet-connected LLM?"** TAS itself is self-hosted; the coding model your customer chooses can be anything from a cloud Anthropic API to an internal model server.
- **"Where does the chat history live?"** Persisted in TAS so reviewers can read it on the PR. Whether it counts as part of the v0.3 audit timeline is an open question.
