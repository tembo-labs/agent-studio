# v0.6 User Stories

> **Migrated to GitHub Issues on 2026-05-29.** These stories are now
> tracked as issues under the **[0.6 — Mycelium milestone](https://github.com/tembo/agent-studio/milestone/2)**
> (label [`enhancement`](https://github.com/tembo/agent-studio/labels/enhancement)).
> This file is kept as the design-rationale pointer; the issues are the
> canonical, status-bearing list. Edit scope in the issues, not here.

Phase 0.6 is a construction phase, not a release train — see
[`ROADMAP.md`](../../ROADMAP.md). Stories use Connextra format
(**As a** *role*, **I want** *capability*, **so that** *benefit*) with
explicit Acceptance Criteria; the full text lives in each issue.

## Issues

| # | Story |
| - | ----- |
| [#14](https://github.com/tembo/agent-studio/issues/14) | Mycelium policy controls |
| [#15](https://github.com/tembo/agent-studio/issues/15) | Pattern export with attribution |
| [#16](https://github.com/tembo/agent-studio/issues/16) | Imports land as PRs |
| [#17](https://github.com/tembo/agent-studio/issues/17) | Compliance verification |
| [#18](https://github.com/tembo/agent-studio/issues/18) | Bilateral and group relationships |
| [#19](https://github.com/tembo/agent-studio/issues/19) | Pattern revocation |
| [#20](https://github.com/tembo/agent-studio/issues/20) | End-user disclosure of imported influence (per-agent) |

## Personas Referenced

- **Enterprise Admin** — sets org-wide policy on shared learning.
- **Workspace Admin** — owns a team's agents; inherits or tightens (never loosens) the org Mycelium policy.
- **Compliance Reviewer** — verifies that cross-deployment exchange matches the org's regulatory posture.
- **Operator** — reviews and merges Mycelium-sourced PRs alongside normal corrections.
- **End User** — interacts with an agent's output, sometimes shaped by an imported pattern.

## Stretch (Considered, Deferred) — intentionally not issues

These were out of scope from the start and were **not** filed as issues;
they record intent, not active work.

- A public Mycelium "marketplace" or registry of agents — explicitly not in scope.
- Federated agent execution across deployments — separate, later phase.
- Sharing raw run data, user content, or PII — explicitly forbidden by the pattern abstraction.
- "Quarantine" mode for newly imported patterns (extra review on first N runs) — promising; gathering signal from v0.6 pilots before promoting.
