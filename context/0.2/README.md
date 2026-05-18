# Tembo Agent Studio v0.2 README

## Press Release (PRFAQ Style)

Today we are launching **Tembo Agent Studio v0.2**, adding chat-driven agent creation and editing with Tembo coding-agent PR workflows. Teams can move from basic runtime setup to day-to-day authoring and operations.

v0.2 introduces a practical balance between speed and control: teams can require review or allow YOLO auto-merge on green checks.

## FAQ

### What is new vs v0.1?
- Chat-to-create agents via PR
- Chat-to-edit agents via PR
- PR policy control (review vs YOLO)
- Basic scheduling
- Basic HITL pause/resume

### Why this phase?
v0.1 proved infrastructure. v0.2 proves iterative authoring velocity.

## Strategy, Features, Technical Details

### Strategy
Convert product intent in chat into auditable source changes.

### Features
- Natural-language authoring loops
- Controlled PR merge policy
- Basic schedule and pause/resume operation

### Technical Details
- Tembo coding agents generate diffs and PRs
- TAS orchestrates run/schedule and minimal HITL state
- Git remains source of truth
