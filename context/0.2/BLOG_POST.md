# Tembo Agent Studio v0.2: Chat Authoring, PR Output

*Draft — internal review*

Here is the moment that decides whether an agent platform survives inside a real organization: a product manager opens a chat and asks for a behavior change.

In most tools, the result is either (a) the change gets made in a SaaS console and disappears from the audit trail, or (b) it gets queued behind an engineer who is also on call this week.

In TAS v0.2, the result is a pull request.

## What v0.2 Adds

- **Chat-to-create.** Describe an agent in natural language; TAS scaffolds it and opens a PR.
- **Chat-to-edit.** Describe a change to an existing agent; TAS opens a PR with the targeted diff.
- **PR policy controls.** Per-agent and per-workspace defaults: review-required, or auto-merge on green CI.
- **Basic scheduling.** Cron-style recurrence on any agent.
- **Basic HITL pause/resume.** An agent can pause for a human step and resume from a one-line UI.

## Why It Matters

Most agent products force a choice: speed *or* governance. Pick one. The teams that pick speed end up with a SaaS console of untracked prompt edits. The teams that pick governance end up with a six-week backlog and angry stakeholders.

v0.2 makes that a false choice. The chat experience is fast — minutes, not weeks — and every result is a pull request your team already knows how to review.

## A Day With v0.2

Imagine a support operations lead on a Tuesday morning:

1. She opens a chat with the "inbox-triage" agent. "Skip messages from these three vendor domains starting today."
2. Two minutes later, a PR appears in the team's repo with a clean diff of the allowlist file.
3. Her CODEOWNERS-required reviewer (an engineer) approves it on his phone over coffee.
4. The next scheduled run picks up the new behavior.

No tickets, no calendar holds, no Slack threads dying in `#data-eng`. The change is live, reviewed, and on the timeline.

## What v0.2 Is Not

- Not the governance release. The audit timeline gets richer in v0.3.
- Not the learning release. End-user corrections become PRs in v0.4.
- Not a license to bypass review. Auto-merge is a per-agent policy choice your admins control.

## The Order Matters

We could have shipped chat authoring as v0.1. We chose not to. Authoring on top of an unreliable runtime is the most common failure mode for this product category — fast at first, broken under load. v0.1 paid the boring bill; v0.2 collects on it.

## What's Next

- **v0.3 — Governance depth.** Immutable `who/when/why`. Rich HITL forms. Per-agent operational dashboards.
- **v0.4 — Adaptive intelligence.** Corrections from end users become PRs. Variants manage divergence. Optional Mycelium connects deployments for shared learning.

If v0.1 proved TAS can run, v0.2 proves TAS can iterate — without giving up the review trail.
