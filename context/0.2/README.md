# Tembo Agent Studio v0.2

## Problem
After foundational setup, teams still face a gap: translating plain-language requests into maintainable source changes is slow and dependent on engineering bandwidth.

Users need authoring velocity, but organizations still need auditable, reviewable change control.

## Our Solution
v0.2 introduces chat-driven authoring through Tembo coding-agent PR workflows.

Users can request new agents and behavior changes in chat; TAS turns that intent into PRs, while teams choose between review-required and YOLO auto-merge on green.

## What Ships in v0.2
- Chat-to-create agent flow with PR output.
- Chat-to-edit existing agent flow with PR output.
- PR policy control (require review vs YOLO auto-merge on green).
- Basic recurring scheduling.
- Basic HITL pause/resume flow.

## Out of Scope for v0.2
- Full immutable governance timeline.
- Advanced HITL form depth.
- Automated correction-to-code learning loops.
- Divergence/variant lifecycle.

## Strategy
Convert conversational intent into governed source updates without requiring users to author code directly.

## Technical Details
- Tembo coding agents handle diff generation and PR creation.
- TAS orchestrates scheduling, run triggers, and pause/resume lifecycle.
- Git remains system of record for agent definitions.

## FAQ
### Why keep PRs instead of direct writes?
PRs preserve reviewability, rollback paths, and organizational trust.

### Is YOLO merge mandatory?
No. It is policy-controlled and optional.

### What does success look like?
Teams iterate on agents in hours instead of days while keeping auditable source control.

## Open Questions Before v0.3
- Which policy guardrails should be global vs per-agent?
- What additional review signals are needed for high-impact automations?
