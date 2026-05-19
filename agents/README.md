# Agents

This folder holds your agent definitions. Tembo Agent Studio supports two
declarative, file-based formats out of the box:

- **Pydantic AI `AgentSpec` (YAML or JSON)** — the canonical, primary format.
  New starter templates and the v0.2 chat-to-PR authoring engine target this
  format. Example: [`hello-world.yaml`](./hello-world.yaml).

- **Cargo AI JSON** — supported as an import path and as a runnable format.
  Useful if you already have Cargo AI agents on disk. Example:
  [`hello-world.json`](./hello-world.json).

Pick whichever format fits the agent. Both live next to each other in the
repo, both diff cleanly in a pull request, and both run through the same
TAS runtime.

For the format decision and rationale, see
[`../context/0.1/AGENT_FORMAT.md`](../context/0.1/AGENT_FORMAT.md).
