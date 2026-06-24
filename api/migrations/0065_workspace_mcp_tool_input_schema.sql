-- Cache each MCP tool's input JSON Schema alongside its name/description, so the
-- /for-agents tool reference can publish a tool's PARAMETERS (not just a
-- one-line description). Agent authors (Tembo CAP) read that reference when
-- writing an agent's `tools:` + instructions; without the param schema they
-- can't discover fields like produce_inbox_item's `links`. Nullable: older
-- cached rows stay until the connection is re-synced (Connections → Refresh).
ALTER TABLE workspace_mcp_tool ADD COLUMN IF NOT EXISTS input_schema JSONB;
