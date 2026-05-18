# v0.6 User Stories

Format: Connextra (**As a** *role*, **I want** *capability*, **so that** *benefit*) with explicit **Acceptance Criteria**.

## Personas Referenced

- **Enterprise Admin** — sets org-wide policy on shared learning.
- **Workspace Admin** — owns a team's agents; inherits or tightens (never loosens) the org Mycelium policy.
- **Compliance Reviewer** — verifies that cross-deployment exchange matches the org's regulatory posture.
- **Operator** — reviews and merges Mycelium-sourced PRs alongside normal corrections.
- **End User** — interacts with an agent's output, sometimes shaped by an imported pattern.

---

## US-0.6-01 — Mycelium policy controls

**As an** Enterprise Admin, **I want** to set Mycelium participation policy at org scope (island / share patterns only / share + receive / receive only), **so that** we can match shared-learning behavior to our regulatory posture without surprises.

**Acceptance Criteria**
- Default is island. Opting in requires an explicit org-admin action and creates a v0.4 changelog event.
- A workspace cannot exceed the org-level Mycelium policy (e.g., if org policy is "share patterns only", a workspace cannot select "share + receive").
- A workspace *can* select a stricter policy than its org (e.g., org allows "share + receive", workspace stays at island).
- All policy changes — org-level or workspace-level — appear in the v0.4 changelog with the acting identity.

---

## US-0.6-02 — Pattern export with attribution

**As a** Workspace Admin in a "share patterns only" or "share + receive" workspace, **I want** outbound patterns to carry signed attribution and provenance, **so that** receiving deployments know where each pattern originated and our org's contribution is verifiable.

**Acceptance Criteria**
- Every exported pattern includes signed attribution metadata (org identity, deployment identity, policy under which exported, timestamp).
- Patterns contain no raw prompts, user content, or PII.
- Each export creates a v0.4 changelog event on the *exporting* side.
- A workspace admin can list all patterns ever exported, with filter by recipient.

---

## US-0.6-03 — Imports land as PRs

**As an** Operator, **I want** an imported Mycelium pattern to land as a normal PR on my deployment — never as a direct write — **so that** the receiving deployment's review surface and audit trail behave identically to internal changes.

**Acceptance Criteria**
- An import never modifies an agent definition directly.
- The resulting PR is labeled as Mycelium-sourced with the originating attribution visible.
- The PR flows through the same review policy as a v0.2 chat-to-PR or a v0.5 correction-to-PR.
- The v0.4 changelog records the import with originating attribution, receiving policy, and the resulting PR number.

---

## US-0.6-04 — Compliance verification

**As a** Compliance Reviewer, **I want** to answer "what crossed our boundary, in either direction, in the last quarter?" from a single audit surface, **so that** I do not have to assemble cross-deployment activity from separate logs.

**Acceptance Criteria**
- The v0.4 changelog filter supports `source=mycelium-export` and `source=mycelium-import`.
- Each entry resolves to the originating identity, the policy under which it occurred, and (for imports) the resulting PR.
- Export of the filtered timeline to SIEM follows the same path as any other changelog export.

---

## US-0.6-05 — Bilateral and group relationships

**As an** Enterprise Admin, **I want** to define explicit peer relationships (one-to-one or named group) for Mycelium exchange, **so that** patterns only flow with deployments we have explicitly partnered with.

**Acceptance Criteria**
- A peer relationship requires both sides to accept; revocation by either side immediately stops further exchange.
- A workspace cannot send to or receive from a peer that the org has not approved.
- There is no central Tembo-hosted registry of peers; discovery is out-of-band or via an optional Tembo-hosted directory service that performs *no* content relay.

---

## US-0.6-06 — Pattern revocation

**As a** Workspace Admin who exported a pattern that turned out to be wrong or misleading, **I want** to mark that pattern as revoked, **so that** peer deployments are notified and can choose to roll back the resulting change.

**Acceptance Criteria**
- A revocation creates a v0.4 changelog event on the exporting side.
- Peer deployments that imported the pattern receive a notification surfaced to a workspace admin.
- The peer's audit trail records the revocation event linked to the original import.
- Revocation does not auto-revert merged changes on the peer — rollback is an explicit operator action.

---

## US-0.6-07 — End-user disclosure of imported influence (per-agent)

**As a** Workspace Admin, **I want** to toggle per agent whether an output discloses to end users that the agent's behavior was influenced by an imported pattern, **so that** transparency-sensitive workflows can disclose, and others can stay quiet.

**Acceptance Criteria**
- The toggle is per-agent and audited.
- When enabled, agent outputs include a non-intrusive disclosure (e.g., a footer or tooltip).
- The toggle defaults to **off** — disclosure is opt-in.

---

## Stretch (Considered, Deferred)

- A public Mycelium "marketplace" or registry of agents — explicitly not in scope.
- Federated agent execution across deployments — separate, later phase.
- Sharing raw run data, user content, or PII — explicitly forbidden by the pattern abstraction.
- "Quarantine" mode for newly imported patterns (extra review on first N runs) — promising; gathering signal from v0.6 pilots before promoting.
