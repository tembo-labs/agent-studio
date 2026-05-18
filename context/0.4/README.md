# Tembo Agent Studio v0.4 — Adaptive Intelligence

> **Headline:** The agent you ship is not the agent you'll run six months later. v0.4 closes the loop: end-user corrections become targeted PRs, divergence becomes managed variants, and shared learning is opt-in.
>
> **Audience:** product owners with live agents in production, plus the enterprise architects who decide whether shared learning is appropriate for the org.

## Problem

After v0.3, customers have a fast authoring loop and a deep audit trail. They are now hitting the next bottleneck:

- **End-user corrections never reach source.** A user clicks "this answer was wrong, here's the right one" — and the feedback dies in a queue no one reads.
- **Conflicting preferences silently collide.** Team A wants the assistant terse. Team B wants the assistant chatty. The author flips a coin in chat and one team complains weekly.
- **Cross-deployment learning is impossible.** Two TAS customers solve the same problem in parallel; neither benefits from the other's iteration.

The product question for v0.4 is: how do we let agents *evolve* without giving up the auditability we just built in v0.3?

## Our Solution

Four capabilities, all routed through the v0.3 governance substrate:

1. **Correction-to-code PRs.** When an end user corrects an output, TAS bundles the original output + the correction + relevant run context and asks a Tembo coding agent to produce a targeted PR.
2. **Modify + Rerun.** A one-click flow for operators: "apply the change you just opened a PR for, run it now, show me the difference."
3. **Divergence detection and variant lifecycle.** When conflicting corrections accumulate across user groups, TAS proposes a variant rather than merging incompatible behavior into the base.
4. **Tembo Mycelium (optional).** Opt-in shared learning across TAS deployments, with attribution, provenance, privacy controls, and the ability to remain in "island mode" indefinitely.

## Operating Principle

**Adaptation is allowed; drift is governed.**

Every adaptive change is still a PR. Every variant has lineage. Mycelium participation is a policy, not a default.

## What Ships in v0.4

- **Correction capture surface.** Inline correction UI on every agent output that supports it; structured payload (original / correction / context / actor) attached to a changelog event.
- **Correction-to-code analysis.** LLM-assisted classification of corrections (style / fact / scope / policy) plus a synthesis step that produces a targeted PR or, where appropriate, a recommendation to open a variant.
- **Modify + Rerun.** A single action that merges a queued PR (subject to policy), refreshes the agent, and reruns the previous input — diff-rendered alongside.
- **Divergence detection.** Heuristics and explicit operator signals identify conflicting correction trends; the system proposes variants rather than silently averaging.
- **Variant lifecycle.** Variants have parents, names, scopes (e.g., "team-eu"), and audit history. Reconciliation (merge variants back) and speciation (commit a variant as its own line) are explicit admin actions.
- **Mycelium (optional).** Workspace and org policies for: nothing shared, share patterns only (no data), share + receive, attribution requirements.

## Out of Scope for v0.4

- Fully autonomous self-modification (we will not ship this; it violates the operating principle).
- Behavioral A/B routing inside a single agent (separate post-v0.4 conversation).
- A public Mycelium "marketplace" of agents — v0.4 is bilateral/group-policy only.

## Strategy

Adapt, don't drift. The platform's value compounds only if customers trust that adaptation doesn't outpace governance. We refuse to ship an "auto-apply correction" path; the PR is the contract.

## Technical Details

- **Correction model.** Append-only events tied to the run that produced the output, the user who corrected it, and (optionally) the structured form they filled.
- **Analysis pipeline.** Tembo coding workflows handle synthesis. Classification feeds into the divergence detector; not every correction produces a PR.
- **Variant graph.** Variants are first-class agent objects with a `parent` reference and a `scope`. The graph is rendered in a lineage view.
- **Mycelium.** Bilateral pattern exchange between TAS instances; no centralized index. Attribution and provenance survive imports.

## Customer Quote (Drafted)

> "Three months in, our customer-reply agent is measurably better than the day we deployed it — and we can point at every change that got it there. Not magic, just corrections turning into PRs the same way our engineers' edits do."
>
> — *Senior PM, e-commerce platform (draft persona)*

## FAQ

### Does Mycelium force data sharing?
No. Default is island mode. Even after opting in, "share patterns only" is the safest level and is recommended for regulated customers.

### Why variants instead of one global behavior?
Because some divergences are real and structural — EU vs US, enterprise vs SMB, support vs sales tone. Forcing them into one definition is the most common failure mode of "self-improving" agent systems. Variants preserve fit without hiding the split.

### Is this fully autonomous self-modification?
No. Every change is still a PR. Every PR is still subject to the v0.2 policy and the v0.3 audit. v0.4 changes the *source* of changes, not the review surface.

### What if the coding agent produces a bad correction PR?
It gets reviewed and rejected, like any other PR. The correction event remains in the changelog so the same correction doesn't get re-synthesized into the same bad PR.

### Can we turn off correction capture entirely?
Yes, per-agent. Some agents (e.g., regulatory drafting) may not allow user-driven adaptation at all.

## Exit Bar (Definition of Done for v0.4)

- [ ] A real end-user correction at a pilot customer produces a merged PR with no engineering involvement in the loop.
- [ ] One pilot customer is running a multi-variant agent in production for at least one month.
- [ ] Mycelium is shipped behind a feature flag with at least one pair of customers exchanging patterns under an explicit attribution policy.
- [ ] The v0.3 changelog cleanly absorbs correction, variant, and Mycelium events without a separate audit surface.

## Open Questions

- Which divergence thresholds (correction volume, conflict ratio) should be defaults for proposing a variant?
- What's the right reconciliation UX when admins want to merge a variant back? Side-by-side diff? Behavior replay?
- Which correction classes should *always* require human review even under YOLO policy (e.g., factual claims, legal copy)?
- Should Mycelium participation be visible to end users when an agent's behavior was influenced by an imported pattern?
- Where does correction-to-code stop and "the human should just edit the agent" begin?
