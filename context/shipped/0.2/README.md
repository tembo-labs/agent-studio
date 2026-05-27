# Tembo Agent Studio v0.2 — Authoring Velocity

> **Headline:** Describe what you want in chat. TAS opens a PR. Your team reviews a diff — not a black box.
>
> **Audience:** product managers, operations leads, and the engineers who otherwise act as the bottleneck for every agent tweak.

## Problem

After a v0.1 pilot, the bottleneck moves. Deploy is solved, auth is solved, runs are solved — but now every meaningful change waits in an engineering queue:

- A PM wants to add a tone tweak to the customer-reply agent. Two-week wait.
- An ops lead wants the triage agent to skip messages from a new vendor list. Open a ticket, get scheduled.
- A support manager wants to add a "did this answer your question?" step. Slacks an engineer. The thread dies.

Either the queue grows, or non-engineers start editing prompts in a SaaS console with no version history and no review — which is exactly the failure mode v0.1 was built to prevent.

We need a way for non-engineers to drive change **without** giving up the audit trail.

## Our Solution

v0.2 introduces **chat-to-PR authoring**:

1. A user opens a chat with an agent (or asks to create one).
2. They describe what they want in plain language ("when the message contains a quote request, route to the sales-quote workflow instead").
3. A Tembo coding agent reads the existing agent definition, produces a targeted diff, and opens a pull request.
4. Reviewers (whoever your repo's CODEOWNERS say) approve or comment.
5. On merge, the new behavior is live.

Organizations choose the trust level per agent: **review-required** for anything customer-facing, **YOLO auto-merge on green CI** for low-stakes internal automations.

This phase also adds **basic scheduling** (cron-like recurrence) so the authored agents have somewhere to go. *(HITL pause/resume was originally scoped for v0.2 too; moved to [v0.3](../0.3/) where it merges cleanly with the rich-HITL-forms work.)*

## What Ships in v0.2

- **Chat-to-create.** "Create an agent that does X" → starter scaffold + opening PR.
- **Chat-to-edit.** "Change behavior Y in the inbox-triage agent" → targeted diff PR.
- **PR policy control.** Per-agent and per-workspace defaults: review-required vs auto-merge-on-green.
- **Basic recurring schedules.** Cron expressions on a per-agent basis.
- *(Moved to [v0.3](../0.3/): basic HITL pause/resume. Merged into the rich-HITL-forms scope so we don't ship a v0.2-shaped pause/resume that v0.3 has to immediately rewrite.)*

## Out of Scope for v0.2

- Full immutable `who/when/why` audit timeline (v0.3).
- Rich HITL forms with conditional fields and file uploads (v0.3).
- Per-agent operational dashboards (v0.3).
- Correction-to-code learning from end-user feedback (v0.4).
- Variant/lineage lifecycle (v0.4).
- Mycelium shared learning (v0.4).

## Strategy

Convert conversational intent into governed source updates **without** asking non-engineers to learn Git or YAML. The PR is the contract: humans review diffs, machines produce them, Git keeps the history. We refuse to introduce a "live edit" path that bypasses review, even as an internal escape hatch.

## Technical Details

- **Authoring engine.** Tembo coding agents handle diff generation against the workspace repo. TAS hands them the existing agent definition + the chat context + a prompt budget.
- **PR creation.** Standard repo provider APIs (GitHub at v0.2; GitLab/self-hosted on the v0.3 open-questions list).
- **Policy enforcement.** Auto-merge only triggers on green CI **and** when the policy allows it for that agent. There is no global override that bypasses an agent's own setting.
- **Schedules.** Workspace-scoped scheduler; runs go through the same execution path as manual runs, just with a different trigger.

## Customer Quote (Drafted)

> "Our PM described in chat what she wanted the agent to do differently, and twelve minutes later there was a PR I could review on my phone. I approved one comment, she merged, and the next run already had the new behavior. That used to be a two-week loop."
>
> — *Engineering Manager, B2B SaaS support tools (draft persona)*

## FAQ

### Why keep PRs instead of direct writes?
Because the PR is the entire reason a non-engineer's change is safe to merge. Direct writes break the audit trail TAS is selling.

### Is YOLO auto-merge mandatory?
No, and we expect most regulated customers to keep it off for customer-facing agents. It's there for internal-only automations where review friction outweighs review value.

### Where did HITL pause/resume go?
Moved to [v0.3](../0.3/). The original v0.2 plan was a "basic" pause step + free-text resume, with v0.3 adding rich forms on top. Splitting it across two phases meant v0.3 would have to immediately rewrite the v0.2 surface — so we now ship one cohesive HITL story in v0.3.

### Can users still edit definitions directly in the repo?
Yes. Chat is one authoring path; a direct PR from an engineer is another. Both flow through the same review policy.

### What's the failure mode when the coding agent can't make the change?
The PR is opened with a clear "I could not complete this — here's what I tried" comment, and the chat thread shows the same. No silent failure.

## Exit Bar (Definition of Done for v0.2)

- [ ] A non-engineer can produce a merged PR end-to-end from a chat session without engineering intervention, at least once per pilot customer.
- [ ] Auto-merge policy works correctly on at least one regulated customer's repo with their CODEOWNERS rules.
- [ ] Median time from "user describes change in chat" to "PR opened" is under 5 minutes for typical small edits.
- [ ] Scheduled runs survive a TAS restart.

## Open Questions Before v0.3

- Which policy guardrails belong **globally** (workspace-wide) vs **per-agent** (override)?
- What additional review signals (test coverage, lint, behavioral diff) should we surface on the PR before v0.3 governance lands?
- Should chat sessions themselves be persisted as part of the audit trail, or only the PR they produce?
- How do we communicate to a chat user that their request crosses a high-risk threshold and needs a human review even under YOLO policy?
- *(Resolved — moved to v0.3.)* Event-driven triggers were originally scoped for v0.2 with `github.pull_request.opened` as the seed source. Moved to [v0.3](../0.3/) because real event triggers depend on a generic **Connections** concept (per-workspace OAuth tokens, webhook signing secrets, signature verification) — and Connections is a v0.3+ deliverable. Building event triggers in v0.2 against a one-off github-only path would create a snowflake that the v0.3 work would have to unpick.
- The agent list and topology map render an agent's trigger as a single human-readable string ("Every 5 min", "On PR open"). Where is this string computed — at write time when the cron / event filter is saved, or at render time? (Affects how we handle malformed cron strings and renamed event sources.)
- The v0.3 mockup launches the chat-to-PR loop from a per-agent modal. Does v0.2 need to ship the global chat surface and the per-agent entry point simultaneously, or is the per-agent surface acceptable as v0.3?
