-- Fix: workspace_mcp_tool.user_id was declared `uuid` in 0029 but
-- better-auth session ids are opaque random strings, not UUIDs.
-- The two other connection tables (workspace_composio_connection,
-- workspace_connection) already use `text` for user_id; this brings
-- workspace_mcp_tool in line so listToolsForUser doesn't reject the
-- session id at the cast boundary.
--
-- Safe to ALTER without data conversion concerns: the table was
-- created in 0029 and rows haven't been inserted yet (every write
-- path failed on the type mismatch).

ALTER TABLE workspace_mcp_tool
  ALTER COLUMN user_id TYPE text USING user_id::text;
