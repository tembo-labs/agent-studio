# Tembo Agent Studio v0.6 — Mycelium

> **Headline:** Two TAS deployments solving the same problem in parallel should be able to learn from each other — under explicit policy, with attribution preserved, and never by accident.
>
> **Audience:** enterprise architects, compliance leads, and platform owners deciding whether (and how) inter-deployment learning fits their org's posture.

## Problem

After v0.5, every TAS deployment is a closed adaptive loop: corrections become PRs, divergence becomes variants, every change is audited and access-controlled. That's the right floor — but it leaves a real cost on the table.

- **Parallel reinvention.** Two TAS customers in the same industry independently solve the same prompt-engineering puzzle. Neither knows the other did. Both pay the same iteration cost.
- **Slow institutional learning.** Patterns hardened over months at one organization are unavailable to a peer organization, even one explicitly willing to exchange them.
- **No safe path to share.** Most teams who *want* to share patterns have no way to do it without leaking data — so they don't try.

The product question for v0.6 is: how do we let TAS deployments learn from each other **without** weakening the deployment-local trust and audit guarantees that v0.1–v0.5 established?

## Our Solution

**Tembo Mycelium** — optional, policy-governed pattern exchange between TAS deployments.

Four policy levels, configurable at org scope (with workspaces inheriting and unable to exceed the org setting):

- **Island.** Nothing leaves, nothing enters. Default. Most regulated customers stay here indefinitely.
- **Share patterns only.** Anonymized behavioral patterns flow outbound; nothing inbound. Recommended for orgs that want to contribute without absorbing external influence.
- **Share + receive.** Two-way exchange with attribution required on both sides.
- **Receive only.** Import patterns from a partner deployment without contributing back.

Exchange is **bilateral or group-policy**, never a public marketplace. Attribution and provenance travel with every pattern. Every import lands in the same v0.4 changelog as any other change — there is no separate "AI changes" audit surface.

## Operating Principle

**Mycelium participation is a policy, not a default.**

Even after opting in, exchange happens under the v0.5 review surface: imported patterns generate PRs, not direct writes. Cross-deployment learning extends the existing operating principles — *adaptation is allowed; drift is governed* — it does not replace them.

## What Ships in v0.6

- **Mycelium policy controls.** Org-level policy with workspace inheritance and audit on every change.
- **Pattern abstraction.** A pattern is a structured, anonymized behavioral signal — not raw data, prompts, or user content. The exact schema is settled in v0.6 design; v0.5 left this as an open question by design.
- **Bilateral and group relationships.** A deployment pairs with one or more peer deployments under a named policy. No central index.
- **Attribution and provenance.** Exported patterns carry a signed attribution record. Imported patterns preserve that record through to the v0.4 changelog.
- **Import-as-PR.** Imports never bypass review. An imported pattern produces a PR (or a variant proposal) against the receiving deployment's agent definitions, scored and labeled as Mycelium-sourced.
- **End-user visibility (configurable).** Per-agent setting: whether an agent's outputs disclose that its behavior was influenced by an imported pattern.

## Out of Scope for v0.6

- A public Mycelium "marketplace" or registry of agents. Not in scope; bilateral/group-policy only.
- Auto-applied imports. Every import flows through the same review surface as any other adaptive change.
- Sharing raw run data, user content, or PII across deployments — explicitly forbidden by the pattern abstraction.
- Federated agent execution across deployments — separate post-v0.6 conversation.

## Strategy

Build the smallest cross-deployment learning surface that earns trust from the most conservative customer. We expect a sizable share of v0.5 customers to never opt in — and that's fine. The product is only credible if "stay in island mode forever" is a first-class choice, not a stepchild.

## Technical Details

- **Transport.** Bilateral pattern exchange between TAS instances; no centralized broker. Optional Tembo-hosted directory service for discovery only (never for content relay).
- **Pattern schema.** Structured representation of a behavioral diff (e.g., variant scope + classified correction shape). Schema versioned; backward-compatible reads required.
- **Attribution.** Signed metadata travels with the pattern; signatures verified on import. Mycelium events in the v0.4 changelog include the signing identity and the policy under which the import occurred.
- **Policy enforcement.** Org → workspace policy inheritance enforced at the API layer, not just the UI. A workspace cannot select a more permissive Mycelium policy than its org. RBAC from v0.4 governs who can change Mycelium policy at all.

## Customer Quote (Drafted)

> "We were not going to be the first customer turning Mycelium on. But seeing 'island' as the default — and watching the audit trail behave the same for imported patterns as for our own corrections — was what made it feel like a real choice rather than a slope."
>
> — *Enterprise Architect, regulated B2B platform (draft persona)*

## FAQ

### Does Mycelium force data sharing?
No. Default is island mode. Even after opting in, "share patterns only" is the safest level and is recommended for regulated customers. Nothing about v0.6 is on by default.

### What's actually inside a pattern?
A structured, anonymized behavioral signal — for example, the shape of a successful variant scope or a classified correction pattern. No raw prompts, no user content, no PII. The schema is settled in v0.6 design and versioned.

### How do we know an imported pattern is trustworthy?
Attribution and provenance travel with the pattern and are verified on import. The receiving deployment reviews the resulting PR like any other change. A bad import gets rejected the same way a bad correction PR does in v0.5.

### Can a workspace override the org-level Mycelium policy?
A workspace cannot select a *more permissive* policy than its org. It can select a stricter one (e.g., org allows "share + receive", workspace stays at "share patterns only"). All such choices are audited.

### Is there a Tembo-hosted marketplace?
No. Mycelium is bilateral or group-policy. There is no public registry of patterns or agents. If we ever do build a directory service, it would be for *discovery* of peer deployments — never for relaying pattern content.

### Does v0.6 require running v0.5?
Yes. v0.6 builds on v0.5's correction, variant, and (via v0.4) changelog substrate. There is no Mycelium-only deployment mode.

## Exit Bar (Definition of Done for v0.6)

- [ ] At least one pair of customers is exchanging patterns under an explicit attribution policy, with both sides' audit trails verifying the exchange.
- [ ] The pattern schema is documented, versioned, and reviewed by at least one regulated customer's compliance team.
- [ ] Org → workspace policy inheritance is enforced at the API layer and demonstrated via a deny-test.
- [ ] An imported pattern produces a reviewable PR on the receiving deployment, with attribution visible in the v0.4 changelog.
- [ ] A customer who stays in island mode sees no behavioral, performance, or UX difference from their v0.5 baseline.

## Open Questions

- What's the exact pattern schema? (v0.5 deliberately left this open.)
- Should Mycelium participation be visible to end users when an agent's behavior was influenced by an imported pattern, as a default, or per-agent only?
- How do we communicate revocation? If a source deployment retracts a pattern, what happens to deployments that already imported it?
- Should there be a "quarantine" mode for newly imported patterns — extra review for the first N runs?
- What's the right abuse-handling story if a peer deployment exports patterns we consider harmful?
- Is there a future role for Tembo-hosted discovery (not relay) for peer-finding?
