---
title: Authoring agents
description: How to create and change agents through chat-to-PR, what's in a Pydantic AgentSpec, and how to pick a model.
---

Agents are authored as files and changed through pull requests. You can write
those files directly, but the usual path is to describe what you want and let
TAS open the PR for you.

## Creating an agent from chat

Describe the agent you want — its job, its tone, the services it should use. TAS
hands the request to the [Tembo Coding Agent Platform](https://tembo.io), which
writes the agent file and opens a pull request against your repo. Review and
merge it; the agent then shows up in the **Agents** list. (This requires a Tembo
API key in **Settings**.)

## The agent file (Pydantic AgentSpec)

A minimal agent is a YAML file under `agents/pydantic-agentspec/`:

```yaml
name: standup-summary
model: anthropic:claude-sonnet-4-6
description: Summarize yesterday's commits into a standup note.
instructions: |
  When invoked, summarize the team's activity in three bullet points.
  Be concise and factual.
```

Key fields:

- **`name`** (required) — must match the filename (`name: foo` → `foo.yaml`);
  lowercase letters, digits, hyphens.
- **`model`** (required) — `provider:model`, e.g. `anthropic:claude-opus-4-8`,
  `anthropic:claude-sonnet-4-6`, `openai:gpt-5.2`, `openai:gpt-4o-mini`. The
  provider's key must be set in **Settings → API keys**.
- **`instructions`** (required) — the system prompt, usually a `|` block scalar.
- **`connections:`** (optional) — external services the agent calls; see
  [Connections](/agent-studio/connections/).
- **`tools_module:`** (optional) — a sibling Python file of deterministic tool
  functions; see [Sidecar Python tools](/agent-studio/sidecar-python-tools/).
- **`labels:`** (optional) — tags used for grouping and for scoping which
  [Slack app](/agent-studio/slack-apps/) may launch the agent.

Your connected repo also carries an authoring guide (`AGENTS.md` and per-framework
`AGENT_GUIDE.md`) that TAS keeps current — that's the canonical, always-up-to-date
field reference for coding agents.

## Choosing a model

Model choice is a cost/reliability tradeoff:

- **Start tool-using agents on a top-tier model** (e.g.
  `anthropic:claude-opus-4-8`). Lower tiers tend to *hedge* on tool use — asking
  "would you like me to…" instead of acting — and a decisive model is easier to
  prove out.
- **Then downgrade and measure.** `anthropic:claude-sonnet-4-6` is much cheaper
  and usually fine when the agent has a single, well-defined job with imperative
  instructions and narrow `connections:`. Compare cost side-by-side on the
  [Runs](/agent-studio/dashboard-and-runs/) page.
- **No tools? Sonnet is a fine starting point** — the hedging problem only shows
  up with tool use.

## Iterating

- **Chat** with an agent to probe its behavior against the live draft, then
  submit a change request that opens a PR.
- **Improve the Agent** from any run turns feedback into a PR — see
  [Improvements](/agent-studio/improvements/).
- **Promote** a draft to a stable version when you're happy with it; runs serve
  the stable snapshot by default. See
  [Core concepts → versioning](/agent-studio/core-concepts/).
