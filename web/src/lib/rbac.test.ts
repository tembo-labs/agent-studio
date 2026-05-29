import { describe, expect, it } from "vitest";

import {
  isWorkspaceRole,
  meetsMinRole,
  WORKSPACE_ROLES,
  type WorkspaceRole,
} from "./rbac";

// Pure RBAC math (US-0.4-02). `meetsMinRole` is the gate every server
// action funnels through via authorizeWorkspace; getting the
// inequality backwards would silently grant access to denied users.
// Pin every (actual, min) pair so a future "let's flatten the role
// hierarchy" refactor can't quietly break the policy.

describe("meetsMinRole", () => {
  it("non-members are always denied", () => {
    for (const min of WORKSPACE_ROLES) {
      expect(meetsMinRole(null, min)).toBe(false);
    }
  });

  it("workspace_admin can do everything", () => {
    for (const min of WORKSPACE_ROLES) {
      expect(meetsMinRole("workspace_admin", min)).toBe(true);
    }
  });

  it("viewer is denied operator + admin actions", () => {
    expect(meetsMinRole("viewer", "viewer")).toBe(true);
    expect(meetsMinRole("viewer", "operator")).toBe(false);
    expect(meetsMinRole("viewer", "workspace_admin")).toBe(false);
  });

  it("operator is admitted to viewer + operator actions, denied admin", () => {
    expect(meetsMinRole("operator", "viewer")).toBe(true);
    expect(meetsMinRole("operator", "operator")).toBe(true);
    expect(meetsMinRole("operator", "workspace_admin")).toBe(false);
  });

  // Belt-and-suspenders: exhaustive matrix. If anyone adds a fourth
  // role later they'll see this fail and remember to update the
  // policy + the matrix in one go.
  it("matrix is the full ordering viewer < operator < workspace_admin", () => {
    const order: WorkspaceRole[] = ["viewer", "operator", "workspace_admin"];
    for (let i = 0; i < order.length; i++) {
      for (let j = 0; j < order.length; j++) {
        expect(meetsMinRole(order[i], order[j])).toBe(i >= j);
      }
    }
  });
});

describe("isWorkspaceRole", () => {
  it("accepts every canonical role", () => {
    for (const r of WORKSPACE_ROLES) {
      expect(isWorkspaceRole(r)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    // Common typos / casing / made-up roles that an attacker (or a
    // buggy form) might submit. Type-narrowing on the return value
    // is what keeps these from leaking into the role column.
    expect(isWorkspaceRole("")).toBe(false);
    expect(isWorkspaceRole("admin")).toBe(false);
    expect(isWorkspaceRole("WORKSPACE_ADMIN")).toBe(false);
    expect(isWorkspaceRole("owner")).toBe(false);
    expect(isWorkspaceRole("org_admin")).toBe(false);
  });
});
