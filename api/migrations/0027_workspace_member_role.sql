-- Tighten workspace_member.role into the v0.4 RBAC vocabulary
-- (US-0.4-02). v0.1 set the column up with a generic 'admin'
-- default; this migration replaces that with the three workspace-
-- scoped roles the v0.4 enforcement layer actually checks:
--
--   workspace_admin  — full admin: secrets, member roles, repo
--                      connection. Can do everything operator can.
--   operator         — day-to-day: run agents, edit automations,
--                      triggers, connections. Cannot change RBAC
--                      or (future) policy.
--   viewer           — read-only across the workspace.
--
-- Backfill: existing 'admin' rows become 'workspace_admin'. Any
-- other legacy value (none expected in v0.3 deployments, but
-- defensive) maps to 'workspace_admin' too — preserving the most
-- permissive grant rather than locking someone out.
--
-- An org-level role tier (org_admin) is deferred until the platform
-- introduces cross-workspace endpoints that need it. The current
-- single-tenant deployment model has no such surfaces.

UPDATE workspace_member
   SET role = CASE
        WHEN role = 'operator' THEN 'operator'
        WHEN role = 'viewer'   THEN 'viewer'
        ELSE 'workspace_admin'
      END;

ALTER TABLE workspace_member DROP CONSTRAINT IF EXISTS workspace_member_role_check;
ALTER TABLE workspace_member
    ADD CONSTRAINT workspace_member_role_check
    CHECK (role IN ('workspace_admin', 'operator', 'viewer'));

-- Drop the legacy DEFAULT 'admin' and replace it with the new
-- canonical default. Newly-added members default to 'operator' —
-- the least-permissive role that still lets the member do real
-- work — except for workspace creators, who become 'workspace_admin'
-- via the application-level createWorkspace path.
ALTER TABLE workspace_member ALTER COLUMN role DROP DEFAULT;
ALTER TABLE workspace_member ALTER COLUMN role SET DEFAULT 'operator';
