-- Normalized tool catalog: one row per tool exposed by a connection.
-- Replaces the JSONB cached_tools blob that lived on workspace_connection,
-- and lets Composio connections cache tools symmetrically with native MCP.
--
-- A single workspace member can hold multiple connections per provider
-- (e.g. "default" and "work" Attio), and each connection exposes its
-- own tool list — hence (workspace_id, user_id, source, provider,
-- connection_name) keys a connection's tool set.
--
-- Tools are refreshed on connect and on demand from the Connections
-- UI; the (refreshed_at) column captures the moment we last
-- re-listed from the upstream so the UI can show staleness.

CREATE TABLE workspace_mcp_tool (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  -- Owner of the connection. Tools are per-user because connections
  -- are per-user (matches workspace_composio_connection +
  -- workspace_connection).
  user_id         uuid NOT NULL,
  -- Which substrate the connection lives in. The two halves never
  -- share tools (composio's REST wrappers vs. the provider's
  -- official MCP server expose different surfaces) so the (source,
  -- provider) pair fully qualifies the row's catalog.
  source          text NOT NULL CHECK (source IN ('composio', 'native-mcp')),
  -- For composio: toolkit slug ("slack", "googlesheets"). For
  -- native-mcp: provider slug from lib/mcp-providers ("attio").
  provider        text NOT NULL,
  -- The user's connection-slot name; "default" unless they named it.
  connection_name text NOT NULL,
  -- Tool slug as exposed by the upstream (Composio's slug or the
  -- MCP server's tool name). Used to call the tool at run time.
  slug            text NOT NULL,
  -- Optional display fields. Composio surfaces both `name` and a
  -- distinct `description`; MCP servers may expose `title` /
  -- `description`. We keep both so the Tools page can render a
  -- useful card without poking the upstream again.
  display_name    text,
  description     text,
  -- When we last re-listed the upstream catalog. The connection-
  -- level UI shows "refreshed Nm ago" off this column.
  refreshed_at    timestamptz NOT NULL DEFAULT NOW(),
  created_at      timestamptz NOT NULL DEFAULT NOW(),

  -- (workspace_id, user_id, source, provider, connection_name, slug)
  -- is the natural key — same tool from the same connection only
  -- exists once. The unique index also accelerates the replace
  -- pattern (DELETE per-connection + INSERT new rows).
  UNIQUE (workspace_id, user_id, source, provider, connection_name, slug)
);

-- The Tools tab queries "every tool this user has in this workspace"
-- and groups by (source, provider, name). Single composite index
-- serves both the list query and the connection-level scope.
CREATE INDEX idx_workspace_mcp_tool_user
  ON workspace_mcp_tool (workspace_id, user_id);
CREATE INDEX idx_workspace_mcp_tool_connection
  ON workspace_mcp_tool (workspace_id, user_id, source, provider, connection_name);

-- workspace_connection.cached_tools / cached_tools_refreshed_at were
-- introduced in 0028 (native MCP substrate) but were always going to
-- be a stop-gap. Now that workspace_mcp_tool exists, drop them — one
-- source of truth, and Composio + native cache through the same path.
ALTER TABLE workspace_connection
  DROP COLUMN IF EXISTS cached_tools,
  DROP COLUMN IF EXISTS cached_tools_refreshed_at;
