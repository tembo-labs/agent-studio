# v0.4 User Stories

Format: Connextra (**As a** *role*, **I want** *capability*, **so that** *benefit*) with explicit **Acceptance Criteria**.

## Personas Referenced

- **End User** — interacts with an agent's output; not a TAS operator.
- **Operator** — runs agents day-to-day.
- **Workspace Admin** — owns a team's agents.
- **Team Lead** — owns a multi-team agent footprint.
- **Platform Architect** — long-term integration owner (e.g., MCP).

Cross-deployment learning personas (Enterprise Admin setting org-wide sharing policy) live in [v0.5 (Mycelium)](../0.5/).

---

## US-0.4-01 — Correction-to-code PR

**As an** End User, **I want** to mark an output wrong and provide a correction, and have TAS turn that correction into a targeted PR against the agent, **so that** the system improves from real usage feedback without an engineering escalation.

**Acceptance Criteria**
- The correction UI captures: original output, corrected output, optional rationale, and references to the run.
- The correction event lands in the v0.3 changelog with the actor and timestamp.
- The system classifies the correction (style / fact / scope / policy) and either opens a PR, proposes a variant, or flags for review.
- The end user is told what happened to their correction (PR opened, variant proposed, queued for review), not silently dropped.

---

## US-0.4-02 — Modify + Rerun

**As an** Operator, **I want** a one-click "Modify + Rerun" action on a queued correction PR, **so that** I can apply the change, refresh the agent, and rerun the previous input with the new behavior — all from one place.

**Acceptance Criteria**
- The action is gated by the agent's PR policy (review-required vs auto-merge).
- After merge, the rerun uses the same inputs that produced the corrected output.
- The rerun result is shown side-by-side with the original output for direct comparison.
- The action records a single composite event in the changelog: `correction → merge → rerun`, with links to each constituent event.

---

## US-0.4-03 — Divergence detection

**As a** Workspace Admin, **I want** TAS to detect when conflicting corrections accumulate along a clear axis (region, team, brand), **so that** user groups can evolve separate variants instead of silently overwriting each other.

**Acceptance Criteria**
- A divergence proposal is created when configured thresholds (correction volume, conflict ratio) are met.
- The proposal includes the suggested variant scope, the evidence (linked corrections), and the recommended parent agent.
- Accepting a proposal creates a variant; rejecting it records the rejection rationale.
- An admin can manually create a variant without waiting for divergence detection.

---

## US-0.4-04 — Variant lineage visualization

**As a** Team Lead, **I want** to see a lineage view of parent agents and their variants, **so that** I can understand evolution history before recommending a merge (reconciliation) or commit (speciation).

**Acceptance Criteria**
- Lineage view shows parent → variant relationships with scope labels.
- Hovering or clicking a variant surfaces: creation reason, current scope, recent corrections, divergence/conflict counters with the parent.
- Reconciliation and speciation are explicit actions with their own audit events.

---

## US-0.4-05 — Per-agent correction capture toggle

**As a** Workspace Admin, **I want** to disable correction capture entirely on specific agents (e.g., regulated drafting), **so that** sensitive workflows do not accept user-driven adaptation.

**Acceptance Criteria**
- The toggle is per-agent and audited on change.
- Disabling capture hides the end-user correction UI for that agent.
- Existing corrections remain in the changelog but no new ones are accepted.

---

## US-0.4-06 — Future MCP integration option

**As a** Platform Architect, **I want** a documented MCP integration option for Tembo authentication and tool connectivity, **so that** TAS can adopt standardized tool-server protocols when our internal MCP rollout matures.

**Acceptance Criteria**
- An MCP-mode flag exists on the workspace's Tembo integration alongside the v0.1 API-key mode.
- The integration mode is auditable.
- API-key mode remains supported throughout v0.4 — MCP is additive, not a forced migration.

---

## Stretch (Considered, Deferred)

- Behavioral A/B testing routing inside a single agent — separate, later phase.
- Auto-apply low-risk corrections without a PR — explicitly out of scope; violates operating principle.
- Cross-deployment pattern exchange — explicitly moved to [v0.5 (Mycelium)](../0.5/).
