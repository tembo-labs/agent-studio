-- Link a run to the run that triggered it. Set when an agent calls the
-- tembo-agent-studio MCP `trigger_run` tool from inside its own run (an
-- orchestrator fanning out to sub-agents): the runner stamps the parent run id
-- onto the MCP request, /mcp records it here. Lets the parent's run page roll
-- up its sub-runs' tokens + cost. Nullable: most runs have no parent.
ALTER TABLE run
    ADD COLUMN IF NOT EXISTS parent_run_id UUID REFERENCES run(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS run_parent_run_id_idx ON run(parent_run_id);
