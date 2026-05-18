# Feature Details (Restored Context)

This file preserves richer product context that is intentionally kept out of the concise README.

## Core Experience

- Chat agents into existence from natural language prompts.
- Chat-driven agent modifications through PR-based workflows.
- One-click and chat-triggered execution.
- Cron-like scheduling controls.
- Human-in-the-loop support for approval and data entry checkpoints.

## Continuous Improvement

- User corrections can be fed back into a code-change workflow.
- Feedback context should include original output, correction, and runtime context.
- Targeted PR generation enables controlled behavior evolution.
- Modify + Rerun supports rapid iteration loops.

## Variants and Lineage

- Divergence detection can identify conflicting preference signals.
- Variant creation allows safe branching of agent behavior.
- Lineage views should show parent/child and divergence relationships.
- Admin workflows should support reconcile, split, archive, and lifecycle controls.

## Governance and Dashboard Expectations

- Per-agent visibility into history, runs, and active human tasks.
- Immutable changelog dimensions: who, when, and why.
- Workspace and agent-level policy controls for PR merge behavior.
- Git-backed change history as source of truth.

## Technical Notes

- Cargo AI JSON remains the baseline internal agent representation.
- Rust backend handles runtime, orchestration, and policy paths.
- Next.js frontend provides chat, forms, and operational surfaces.

## Scope Note

These details describe the target system behavior across phases and are not all expected in `v0.1`.
