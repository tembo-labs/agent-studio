# Blog Post: Tembo Agent Studio v0.2 - Chat Authoring With Controlled Speed

v0.2 is the release where TAS starts feeling like a real daily product for builders and operators.

In v0.1, we focused on reliable setup and execution. In v0.2, we focus on turning natural-language intent into controlled code changes.

## What Changed
Users can now ask TAS to create or modify agents in chat. Instead of opaque automation, TAS uses Tembo coding-agent workflows to produce pull requests.

That means teams get speed and traceability together:
- non-technical users can request changes directly,
- engineering teams can still review diffs,
- organizations can decide when YOLO auto-merge is acceptable.

## Why This Matters
Most internal agent projects stall at the handoff point between idea and implementation. Product or operations teams know what they want, but changes wait in engineering queues.

v0.2 reduces that delay while preserving strong software process.

## Included in This Phase
- Chat-to-create via PR.
- Chat-to-edit via PR.
- PR merge policy controls.
- Basic scheduling and HITL pause/resume.

## What We Are Not Claiming Yet
This is not the governance-heavy or adaptive-learning release. We are not yet solving full audit-depth, correction-driven source evolution, or variant lineage.

Those arrive in v0.3 and v0.4 after the authoring loop is proven in production-like workflows.

## Practical Outcome
If v0.1 proved TAS can run, v0.2 proves TAS can iterate.
