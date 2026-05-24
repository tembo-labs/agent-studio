# Agents

This folder holds your agent definitions, organized by framework:

```
agents/
├── pydantic-agentspec/    Pydantic AI `AgentSpec` (YAML or JSON)
│   └── hello-world.yaml   ← starter sample
└── cargo-ai/              Cargo AI JSON
    └── hello-world.json   ← starter sample
```

One subfolder per framework. The v0.1 create-agent UI writes new files
into the right subfolder automatically based on the parsed shape.

**Supported frameworks in v0.1:**

- **Pydantic AI `AgentSpec`** (YAML or JSON) — the canonical, primary
  format. Parsed, listed, and **runnable** end-to-end against Anthropic.
- **Cargo AI** (JSON) — single-file definitions with `agent_schema` and
  `actions`. Parsed and listed in v0.1; runtime support is wired
  separately (see `context/0.3/README.md` for the broader multi-framework
  direction).

**Layout is required.** Agents must live in the right framework
subfolder. Files placed directly at `agents/foo.yaml` (no subfolder)
are ignored by the listing surface — move them into
`agents/pydantic-agentspec/` or `agents/cargo-ai/` as appropriate.

For the format decision and rationale, see
[`../context/0.1/AGENT_FORMAT.md`](../context/0.1/AGENT_FORMAT.md).
