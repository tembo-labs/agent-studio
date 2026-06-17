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

- **`name`** (required) — the slug identifier; must match the filename
  (`name: foo` → `foo.yaml`); lowercase letters, digits, hyphens. It's the
  stable key for URLs, runs, and automations, so don't change it after creation.
- **`title`** (optional) — a free-text display name shown in the UI (e.g.
  `title: "Inbox Triage"`). When you create an agent you can type any name; the
  filename slug is derived from it and the text is saved as `title`. The UI falls
  back to `name` when there's no title.
- **`model`** (required) — `provider:model`, e.g. `anthropic:claude-fable-5`,
  `anthropic:claude-opus-4-8`, `anthropic:claude-sonnet-4-6`, `openai:gpt-5.5`,
  `openai:gpt-4o-mini`. The provider's key must be set in
  **Settings → LLM Providers**.
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
- **Need more than Opus?** `anthropic:claude-fable-5` is Anthropic's most
  capable widely-released model (Mythos-class) — best on the hardest reasoning
  and long-horizon agentic work, at ~2× the cost. Reach for it only when Opus
  4.8 isn't enough.
- **Then downgrade and measure.** `anthropic:claude-sonnet-4-6` is much cheaper
  and usually fine when the agent has a single, well-defined job with imperative
  instructions and narrow `connections:`. Compare cost side-by-side on the
  [Runs](/agent-studio/dashboard-and-runs/) page.
- **No tools? Sonnet is a fine starting point** — the hedging problem only shows
  up with tool use.

## Iterating

- **Chat-to-edit** — probe the live draft in the agent chat surface, then submit
  a change request that opens a PR. See
  [Agent lifecycle](/agent-studio/agent-lifecycle/).
- **Improve the Agent** from any run turns feedback into a PR — see
  [Improvements](/agent-studio/improvements/).
- **Promote** a draft to a stable version when you're happy with it; automated
  runs serve stable by default. See
  [Agent lifecycle → promoting](/agent-studio/agent-lifecycle/#promoting-to-stable).

## Eve agents (experimental)

Alongside Pydantic AgentSpec and Cargo AI, TAS can run agents built with
[Vercel Eve](https://github.com/vercel/eve). Unlike the others, an Eve agent is
a **directory** of TypeScript files under `agents/eve/<name>/` (an `agent/agent.ts`,
`agent/instructions.md`, a `package.json`, and a committed lockfile) rather than a
single spec file. TAS runs it one turn at a time, locally and in-process — no
Vercel deployment required.

One rule matters when authoring for TAS: **configure the model with a direct
`@ai-sdk` provider, not the AI Gateway string.** TAS runs with your workspace's
Anthropic/OpenAI key and has no Gateway credentials, so:

```ts
import { defineAgent } from "eve";
import { anthropic } from "@ai-sdk/anthropic";

export default defineAgent({ model: anthropic("claude-opus-4-8") });
```

Add the provider package to the project's dependencies and commit the lockfile.
Current scope: Eve agents always run their live directory (no versioned promotion
yet), and chat-run isn't available for them — use **Run** on the agent page.
