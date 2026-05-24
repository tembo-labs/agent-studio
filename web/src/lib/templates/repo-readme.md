# {{WORKSPACE_NAME}}

This repository is the source of truth for **{{WORKSPACE_NAME}}**'s
[Tembo Agent Studio](https://github.com/tembo/agent-studio) workspace.

## What lives here

- **`agents/`** — one file per agent. Tembo Agent Studio currently supports
  the [Pydantic AI `AgentSpec`](https://ai.pydantic.dev/docs/ai/core-concepts/agent-spec/)
  format (YAML or JSON). Each file declares an agent's `name`, `model`,
  `instructions`, and whatever else the spec allows.
- This README. Edit it to describe what your team's agents do.

## How changes happen

Edits to an agent definition flow through GitHub like any other code
change in your org:

1. Open a pull request that modifies the agent's file in `agents/`.
2. Your team reviews the diff.
3. On merge, the new behavior is live on the next run.

Tembo Agent Studio's v0.2 release adds chat-driven authoring: describe the
change in chat, and a Tembo coding agent opens the PR for you.

## References

- [Tembo Agent Studio](https://github.com/tembo/agent-studio)
- [Pydantic AI AgentSpec reference](https://ai.pydantic.dev/docs/ai/core-concepts/agent-spec/)
