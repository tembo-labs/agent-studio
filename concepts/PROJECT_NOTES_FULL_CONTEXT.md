# Project Notes (Full Context)

This file captures important planning context that should not be lost between README iterations.

## Product Positioning

- TAS is the non-technical companion to tembo.io.
- TAS is open-source and self-hosted per organization.
- TAS provides a clean operational UI similar in spirit to Paperclip-style governance UX (not a compatibility target).

## Agent Creation and Change Model

- Users create and modify agents through chat.
- TAS requests code/config changes from Tembo coding agents.
- Changes land as PRs with configurable policy:
  - Require review.
  - YOLO auto-merge on green.

## Runtime and Human-in-the-Loop

- TAS provides runtime execution with run-now and scheduling.
- HITL is first-class: approvals, data entry, file uploads, conditional fields, previews.
- Runtime pauses for human input and resumes after response.

## Correction-to-Code Learning

- When a user corrects output, TAS packages original output + correction + context.
- Tembo LLM/coding flow analyzes the delta and generates a targeted PR.
- Explicit workflow: "Modify + Rerun" should support one-click feedback-driven update and rerun.

## Biological Evolution Model

- Terminology: variant, lineage, divergence, speciation, reconciliation.
- Divergence detection identifies conflicting preference signals from different humans.
- Default behavior: automatic variant creation (admin-configurable).
- Early variant state: diverging (separate agent object but still linked to parent).
- Admin actions: reconcile/merge back, force speciation, archive, manual variant creation.
- Default visibility: all users can see all variants (admin-configurable).

## Changelog and Governance

- Full immutable changelog per agent/variant:
  - Who changed it.
  - When it changed.
  - Why it changed (feedback/context text).
- Dashboard should centralize runs, history, active HITL forms, changelog, and lineage.

## Mycelium Network Model

- Name: Tembo Mycelium.
- Optional connection of TAS instance to a shared learning network.
- Private island mode or networked collective mode.
- Share/import patterns, templates, variants, learned behaviors.
- Attribution, provenance, and granular privacy controls are required.

## Technical Direction

- Cargo AI JSON is the default internal agent representation (technical detail, not top-level marketing headline).
- Rust backend API is central for runtime orchestration.
- Next.js frontend for chat, governance UI, and HITL forms.
- Primary Tembo integration uses API access key; MCP mode is future-facing when publicly available.

## Scope and Sequencing

- Rollout should proceed `0.1` to `0.4`, foundational first, advanced later.
- `0.1` proves deploy/auth/connect/run.
- `0.4` contains adaptive intelligence, variants/lineage, and Mycelium networking.
