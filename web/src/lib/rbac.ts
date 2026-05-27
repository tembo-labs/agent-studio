// Role-based access control (US-0.4-02).
//
// Three workspace-scoped roles, with a strict ordering:
//
//   viewer < operator < workspace_admin
//
// Per the user-story acceptance criteria:
//
//   * A viewer cannot trigger runs, change policy, or approve PRs.
//   * An operator cannot change RBAC settings or (future) policy.
//   * A workspace_admin can do everything in their workspace.
//
// An org_admin tier (cross-workspace) is deferred until there are
// concrete cross-workspace endpoints to gate on it. Single-tenant
// deployments have no such surfaces today.
//
// This module is the *policy* layer. Reads go through getWorkspaceRole;
// gating decisions go through meetsMinRole / requireWorkspaceRole. No
// server action or route handler should query workspace_member.role
// directly — change happens here, in one place.

export const WORKSPACE_ROLES = [
  "viewer",
  "operator",
  "workspace_admin",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

const ROLE_LEVEL: Record<WorkspaceRole, number> = {
  viewer: 0,
  operator: 1,
  workspace_admin: 2,
};

export function isWorkspaceRole(v: string): v is WorkspaceRole {
  return (WORKSPACE_ROLES as readonly string[]).includes(v);
}

/**
 * Returns true when `actual` (the user's current role, or null if not
 * a member) meets or exceeds `min`. Non-members always return false.
 */
export function meetsMinRole(
  actual: WorkspaceRole | null,
  min: WorkspaceRole,
): boolean {
  if (actual === null) return false;
  return ROLE_LEVEL[actual] >= ROLE_LEVEL[min];
}

export type RoleLabel = {
  role: WorkspaceRole;
  label: string;
  description: string;
};

// Display copy for the role picker + member list. Kept here so the
// labels travel with the canonical role definitions instead of
// drifting in a Settings-page lookup table.
export const ROLE_DESCRIPTIONS: RoleLabel[] = [
  {
    role: "workspace_admin",
    label: "Workspace admin",
    description:
      "Manage credentials, repo connection, and member roles. Can do everything an operator can.",
  },
  {
    role: "operator",
    label: "Operator",
    description:
      "Run agents, edit automations, triggers, and connections. Cannot manage credentials or member roles.",
  },
  {
    role: "viewer",
    label: "Viewer",
    description:
      "Read-only across the workspace. Cannot trigger runs, edit agents, or change anything.",
  },
];
