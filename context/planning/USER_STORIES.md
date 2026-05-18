# Tembo Agent Studio User Stories

This document uses Connextra format:

**As a** `[role]`, **I want** `[capability]`, **so that** `[benefit]`.

## Phase `0.1` Foundation

- As a platform administrator, I want to deploy TAS with Docker, so that my team can run Agent Studio in our own environment quickly.
- As an IT security lead, I want TAS authentication to run through better-auth, so that we can integrate with our internal identity provider and policies.
- As a workspace admin, I want to configure a Tembo API access key per workspace, so that TAS can securely invoke Tembo services for that workspace.
- As a workspace admin, I want to connect a GitHub repository during onboarding, so that agent definitions and changes are version-controlled from day one.
- As an operator, I want to create or import a baseline agent definition, so that we can run a first production-relevant workflow.
- As an operator, I want to trigger an agent run manually and view run status/logs, so that I can validate the setup before wider team rollout.

## Phase `0.2` Authoring Flow

- As a product manager, I want to describe a new agent in chat and have a PR generated, so that non-engineers can request agent creation without writing code.
- As an operator, I want to ask for agent behavior changes in chat and receive a PR, so that updates remain traceable and reviewable.
- As an engineering manager, I want configurable PR policy (review-required or auto-merge on green), so that we can match automation speed to our risk tolerance.
- As an operator, I want to schedule recurring agent runs, so that routine workflows execute without manual intervention.
- As an operator, I want agents to pause for human input and resume, so that we can safely handle steps that require approvals or external data.

## Phase `0.3` Governance and Collaboration

- As a compliance stakeholder, I want an immutable changelog of who changed what and why, so that we can satisfy audit and incident review requirements.
- As a reviewer, I want rich HITL forms with validation and conditional logic, so that approvals and data entry are accurate and efficient.
- As a workspace admin, I want per-agent dashboards for runs, history, and active human tasks, so that I can monitor reliability and workload.
- As an organization admin, I want role-based controls for agent operations and policy settings, so that teams can collaborate safely at scale.
- As a support engineer, I want to inspect failed runs and associated human actions, so that I can diagnose issues and improve runbooks.

## Phase `0.4` Adaptive Intelligence

- As an end user, I want corrections on agent output to generate targeted code-change PRs, so that the system improves from real usage feedback.
- As an operator, I want a one-click Modify + Rerun workflow, so that I can quickly test behavior changes after giving feedback.
- As a workspace admin, I want divergence detection across conflicting feedback, so that different user groups can evolve separate agent variants safely.
- As a team lead, I want lineage visualization of parent and variant agents, so that we can understand evolution history before merging or splitting behavior.
- As an enterprise admin, I want optional Mycelium sharing controls, so that we can decide whether to keep learning private or participate in a shared network.
- As a platform architect, I want a future MCP integration option for Tembo, so that TAS can support standardized tool connectivity when the public MCP is available.
