# v0.5 Demo Script

**Target audience:** enterprise architect, compliance lead, and platform owner at a customer already operating TAS at v0.4. Mycelium is a *different conversation* than v0.1–v0.4; do not stack this demo with the adaptive-intelligence one.
**Target duration:** 25–30 minutes.
**Goal of the demo:** prove that Mycelium is a real choice — not a default surprise — and that "stay in island mode forever" is a first-class outcome.

## Pre-Demo Checklist (Off-Screen)

- Two TAS deployments at v0.4 baseline (call them `acme` and `globex`) with a pre-negotiated bilateral peer relationship.
- Both org-level Mycelium policies currently set to **island**.
- Two pre-staged outbound patterns on `acme` (e.g., a hardened variant scope and a classified correction pattern). Realistic but anonymized.
- One pre-staged revocation scenario (a previously-exported pattern that the exporter wants to retract).
- A recorded video fallback of pattern exchange in case live transport fails.
- Optional: a regulated-customer persona briefed to ask the "we will never turn this on" question, so the answer lands cleanly.

## Flow (with rough timings)

### 1. Frame the conversation (0:00 – 3:00)
**Say:**
> "Everything you've seen through v0.4 keeps your agents' evolution inside your walls. v0.5 — Mycelium — is the optional substrate for two TAS deployments to learn from each other. Three things to know up front. One: this is off by default. Two: it never moves data, only anonymized behavioral patterns. Three: imports land as PRs, on your audit trail, just like everything else. If by the end of this demo you decide you want to stay in island mode, that is a supported outcome, not a missed sale."

### 2. The default — island (3:00 – 5:00)
**Show:** the Mycelium settings panel on `acme`, with org policy set to **island**.
**Say:**
> "Default is island. Nothing leaves. Nothing enters. Many of our customers will stay here, and the rest of TAS is identical for them. Mycelium is opt-in; it is not a deferred default."

### 3. Establish a peer relationship (5:00 – 9:00)
**Show:** the peer-relationship UI. Walk through:
- `acme` proposes a bilateral relationship with `globex`.
- `globex`-side admin accepts.
- Show the resulting changelog entry on both sides.

**Say:**
> "Mycelium is bilateral or group-policy. There is no Tembo-hosted marketplace, no public registry. If we ever do a directory service, it's for discovering peers — never for relaying content. Both sides must accept. Either side can revoke. The acceptance itself is in the audit trail."

### 4. Flip policy to 'share patterns only' (9:00 – 12:00)
**Show:** org policy change on `acme` from island → share patterns only.
**Do:**
- Show the changelog entry naming the acting admin and the policy delta.
- Show a workspace under `acme` that has chosen to *remain* in island despite org permission.

**Say:**
> "Workspaces inherit the org policy and can be stricter, never more permissive. Even when the org turns on sharing, a workspace can opt out. Both choices are audited."

### 5. Export a pattern (12:00 – 16:00)
**Show:** the patterns surface on `acme`. Pick a hardened variant scope.
**Do:**
- Show the exact pattern payload — anonymized, no prompts, no user content.
- Show the signed attribution and provenance metadata.
- Trigger export.
- Switch to the `globex` deployment.

**Say:**
> "This is what a pattern is, and just as importantly, what it isn't. No raw prompts. No user content. No PII. A pattern is a behavioral signal — the shape of something that worked — with attribution signed by the exporting org."

### 6. Import lands as a PR (16:00 – 22:00)
**Show:** `globex`'s view of the inbound pattern.
**Do:**
- Show that the import did *not* modify any agent directly.
- Show the resulting PR, labeled "Mycelium-sourced — Acme Corp (verified attribution)".
- Show the v0.3 changelog entry on `globex` with originating attribution + the PR link.
- Walk through the PR review like any other v0.4 correction PR.

**Say:**
> "This is the key trust move. An imported pattern goes through your existing review surface, not around it. The label tells your reviewer where it came from. The audit trail records the import, the attribution, the policy under which it landed, and the PR that resulted. There is no separate Mycelium activity tab — it lives in the same changelog as your engineers' PRs and your end users' corrections."

### 7. Revocation (22:00 – 27:00)
**Show:** on `acme`, mark a previously-exported pattern as revoked.
**Do:**
- Show the changelog entry on `acme`.
- Switch to `globex`: a notification surfaces to the workspace admin.
- Show the linked changelog entry on `globex` tying the revocation back to the original import and any merged PR.

**Say:**
> "Revocation does not auto-rip-out merged changes. That would be its own trust failure. What it does do is notify the receiving admin and link the events together so the rollback decision is an explicit operator action with full context."

### 8. Wrap (27:00 – 30:00)
**Show:** the five-phase roadmap, all complete.
**Say:**
> "v0.1 through v0.4 made TAS deployable, iterable, auditable, and adaptive — inside your walls. v0.5 is the optional next floor: learning across deployments under explicit policy. The trust ladder runs in this direction on purpose. If you want to stay on the v0.4 floor forever, that's a supported choice. If you want to take the v0.5 step with a specific peer, we'll set up the bilateral relationship together."

## Live-Demo Failure Plan

| If… | Then say… |
| --- | --------- |
| Pattern exchange transport fails live | Cut to recorded video. Acknowledge: "Mycelium is the capability that benefits most from being seen between real deployments — we can run a guided pilot with a peer customer of yours." |
| The audience pushes hard on "what if a peer exports something harmful?" | Use the revocation path + PR review as the answer. "The receiving side reviews every import. A bad export gets rejected on the receiving side and revoked on the source side. The pattern abstraction is also the reason this is bounded — no data flows, only behavioral signals." |
| Org-vs-workspace policy override demo doesn't trigger cleanly | Use the API to show the deny response. "The enforcement is at the API layer, not just the UI — that's a hard constraint." |

## Success Criteria (Demo)

- A peer relationship is established live, with audit entries visible on both sides.
- A pattern flows from `acme` to `globex` and lands as a reviewable PR with verified attribution.
- A revocation is demonstrated, with linked audit entries on both sides.
- The audience leaves understanding that **default is island** and that staying there is a supported outcome.
- No one in the room mistakes Mycelium for data sharing.

## Common Questions & Crisp Answers

- **"Is this data sharing?"** No. Patterns are anonymized behavioral signals — shape of what worked, not what was said. No prompts, no user content, no PII.
- **"Is there a marketplace?"** No. Bilateral or group-policy only. No public registry.
- **"What if we never turn it on?"** Supported outcome. TAS behaves identically for an island-mode customer.
- **"Can our workspace opt out even if our org turned it on?"** Yes — strictly stricter is always allowed. The reverse is not.
- **"Can imports modify our agents without us seeing?"** No. Imports always land as PRs and follow your existing review policy.
- **"What happens to merged imports if the source revokes?"** You get notified and shown the linked audit chain. The rollback decision is explicit — we don't auto-revert.
- **"Does v0.5 require v0.4?"** Yes. Mycelium builds on v0.4's correction, variant, and changelog substrate.
- **"What's after v0.5?"** Depth in specific verticals and platform extensibility. Phase docs when planned, not before.
