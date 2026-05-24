# Agents

This folder holds your agent definitions. Tembo Agent Studio supports two
declarative, file-based formats out of the box:

- **Pydantic AI `AgentSpec` (YAML or JSON)** — the canonical, primary format.
  Parsed, listed, and **runnable** in v0.1. The "From template" path in the
  create-agent UI emits this format. Example:
  [`hello-world.yaml`](./hello-world.yaml).

- **Cargo AI JSON** — single-file agent definitions with `agent_schema` and
  `actions`. Parsed and listed in v0.1 (paste-import via the create-agent
  UI). The Cargo AI **runtime** lands with the v0.3+ multi-framework slice
  (see [`../context/0.3/README.md`](../context/0.3/README.md)) — until
  then, Run now is hidden on these agents. Example:
  [`hello-world-cargo.json`](./hello-world-cargo.json).

Pick whichever format fits the agent. Both live next to each other in the
repo, both diff cleanly in a pull request, and both surface in the same
agent list with framework + model badges so triage knows which is which.

For the format decision and rationale, see
[`../context/0.1/AGENT_FORMAT.md`](../context/0.1/AGENT_FORMAT.md).
