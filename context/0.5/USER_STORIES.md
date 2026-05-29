# v0.5 User Stories

> **Migrated to GitHub Issues on 2026-05-29.** These stories are now
> tracked as issues under the **[0.5 — Adaptive intelligence milestone](https://github.com/tembo/agent-studio/milestone/1)**
> (label [`roadmap`](https://github.com/tembo/agent-studio/labels/roadmap)).
> This file is kept as the design-rationale pointer; the issues are the
> canonical, status-bearing list. Edit scope in the issues, not here.

Phase 0.5 is a construction phase, not a release train — see
[`ROADMAP.md`](../../ROADMAP.md). Stories use Connextra format
(**As a** *role*, **I want** *capability*, **so that** *benefit*) with
explicit Acceptance Criteria; the full text lives in each issue.

## Issues

| # | Story |
| - | ----- |
| [#8](https://github.com/tembo/agent-studio/issues/8) | Correction-to-code PR |
| [#9](https://github.com/tembo/agent-studio/issues/9) | Modify + Rerun |
| [#10](https://github.com/tembo/agent-studio/issues/10) | Divergence detection |
| [#11](https://github.com/tembo/agent-studio/issues/11) | Variant lineage visualization |
| [#12](https://github.com/tembo/agent-studio/issues/12) | Per-agent correction capture toggle |
| [#13](https://github.com/tembo/agent-studio/issues/13) | Future MCP integration option |

## Personas Referenced

- **End User** — interacts with an agent's output; not a TAS operator.
- **Operator** — runs agents day-to-day.
- **Workspace Admin** — owns a team's agents.
- **Team Lead** — owns a multi-team agent footprint.
- **Platform Architect** — long-term integration owner (e.g., MCP).

Cross-deployment learning personas (Enterprise Admin setting org-wide
sharing policy) live in [v0.6 (Mycelium)](../0.6/).

## Stretch (Considered, Deferred) — intentionally not issues

These were out of scope from the start and were **not** filed as issues;
they record intent, not active work.

- Behavioral A/B testing routing inside a single agent — separate, later phase.
- Auto-apply low-risk corrections without a PR — explicitly out of scope; violates the operating principle (every adaptive change is a PR).
- Cross-deployment pattern exchange — moved to [v0.6 (Mycelium)](../0.6/).
