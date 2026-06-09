---
title: Skills
description: Give agents reusable Agent Skills (SKILL.md folders) from skills.sh, custom uploads, or the Claude API — committed to your repo and opted into per agent.
---

**Skills** are reusable capabilities you attach to agents. Each skill is a
folder — a `SKILL.md` (instructions + metadata) plus optional scripts and
resources — following Anthropic's [Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
format. An agent **opts in** to the skills it needs; at run time the model can
read a skill's instructions and run its scripts.

Skills live as files in your connected repo under `skills/<name>/`, right
alongside `agents/`. They run **locally** in your environment (no Anthropic
code-execution sandbox) and work with **any model**.

## Installing skills

Open **Skills** in the sidebar. Three sources, each commits the skill folder to
your repo:

- **skills.sh** — browse and search the open
  [Agent Skills directory](https://www.skills.sh/) right in the app and install
  with one click. (You can also paste a slug or GitHub URL for a skill that
  isn't in the directory.)
- **Upload** — a custom skill bundled as a `.zip` (a folder containing
  `SKILL.md`).
- **Import from the Claude API** — copy a skill your team created via the Claude
  Skills API into the repo. Needs an Anthropic API key in
  [Settings → LLM Providers](/agent-studio/settings/).

Installing and removing skills is a workspace-admin action and is recorded in
the [audit log](/agent-studio/audit-and-roles/).

## Opting an agent in

Add the skill's folder name to the agent's `skills:` field (the Tembo coding
agent does this when you ask it to use a skill):

```yaml
name: deck-builder
model: anthropic:claude-opus-4-7
instructions: |
  Build slide decks from the user's outline.
skills:
  - pptx
  - brand-guidelines
```

The agent page shows which skills an agent uses. A run resolves the named
folders from the repo and mounts them; a declared-but-missing skill fails the
run (same as a missing `tools_module`).

## At run time

Skills are mounted with [pydantic-ai-skills](https://pypi.org/project/pydantic-ai-skills/):
the model gets tools to load a skill's instructions, read its resources, and run
its scripts. Skill scripts execute in the agent's runtime — the same trust model
as [sidecar Python tools](/agent-studio/sidecar-python-tools/) (your own,
review-gated repo code). Nothing runs in an Anthropic-hosted container.

:::note
Skills are text (SKILL.md, scripts, references). Binary resources aren't
supported and are skipped on import/upload.
:::
