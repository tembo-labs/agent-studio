-- Track when the tool-cache reconcile last ran, so the boot/scheduled reconcile
-- can throttle itself (skip if it ran very recently — a crash-loop guard) while
-- still refreshing every native-MCP + Composio connection's cached tool catalog
-- on each deploy and daily. Single-row instance_settings table (migration 0031).
ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS last_tool_reconcile_at TIMESTAMPTZ;
