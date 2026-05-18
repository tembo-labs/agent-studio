# Tembo Agent Studio v0.4

## Problem
Even with strong governance, static agent behavior degrades when real user preferences evolve. Teams need a way for human corrections to improve source behavior, while preventing uncontrolled drift across user groups.

## Our Solution
v0.4 introduces adaptive intelligence with governance:
- correction-to-code learning loops,
- one-click Modify + Rerun,
- divergence detection with managed variants,
- optional Mycelium network participation.

## What Ships in v0.4
- Correction-to-code PR generation from user feedback and run context.
- Explicit Modify + Rerun flow.
- Divergence detection and variant creation lifecycle.
- Lineage visibility and reconciliation/speciation controls.
- Optional Tembo Mycelium shared-learning mode with policy controls.

## Operating Principle
Adaptation is allowed, drift is governed.

## Technical Details
- LLM-assisted correction analysis routed through Tembo coding workflows.
- Variant metadata and lineage graph state for governance.
- Mycelium import/share controls with attribution, provenance, and privacy settings.

## FAQ
### Does Mycelium force data sharing?
No. Instances can remain private (island mode). Network participation is optional and policy-controlled.

### Why variants instead of one global behavior?
Different human groups often require conflicting outcomes. Variants preserve fit without hiding divergence.

### Is this fully autonomous self-modification?
No. Changes remain PR-mediated and policy-governed.

## Open Questions
- Which divergence thresholds should be default for auto-variant creation?
- What merge/reconciliation UX best supports admins at scale?
- Which feedback classes should always require review even in YOLO mode?
