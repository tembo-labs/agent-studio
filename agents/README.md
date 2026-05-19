# Agents

This folder holds your agent definitions. Tembo Agent Studio supports
multiple formats.

**Declarative defaults — ship as v0.1 starters:**

- **Pydantic AI `AgentSpec` (YAML or JSON)** — the canonical declarative
  default. Best fit for non-engineer authoring and the v0.2 chat-to-PR
  loop. Example: [`hello-world.yaml`](./hello-world.yaml).

- **Cargo AI JSON** — alternate declarative default. Single-file, locally
  runnable, supports the "hatch to native binary" story.
  Example: [`hello-world.json`](./hello-world.json).

**Code-defined frameworks — first-class supported:**

- **LangGraph**, **OpenAI Agents SDK**, **Mastra**, **CrewAI**, and
  **Pydantic AI's code mode** are all supported runtimes. Complex agents
  often need custom tools, durable execution, or tight integration with a
  host application — those use cases want code, not a YAML file.

Pick whichever format fits the agent. The PR policy engine (review-required
vs YOLO auto-merge, per agent) handles governance regardless of format.

For the full format decision, the v0.1 ship list, and the development-vs-
production policy model, see
[`../context/0.1/AGENT_FORMAT.md`](../context/0.1/AGENT_FORMAT.md).
