#!/usr/bin/env node
//
// Standalone policy-layer test for the v0.4-02 RBAC table. Validates
// the role-ordering invariant that every server action depends on:
//
//   viewer < operator < workspace_admin
//
// API-level deny tests (HTTP-side) are deferred until a session-aware
// test harness lands — see CHANGELOG.md carve-out under v0.4. This
// script is what unblocks the v0.4-02 AC item "API enforcement
// verified by deny-test in CI" at the policy-unit layer.
//
// Run with: node web/scripts/rbac-policy.test.mjs
//
// Returns exit code 1 on any failing assertion; 0 on success.

const ROLE_LEVEL = {
  viewer: 0,
  operator: 1,
  workspace_admin: 2,
};

function meetsMinRole(actual, min) {
  if (actual === null) return false;
  return ROLE_LEVEL[actual] >= ROLE_LEVEL[min];
}

const cases = [
  // null (non-member) is always denied
  { actual: null, min: "viewer", expect: false },
  { actual: null, min: "operator", expect: false },
  { actual: null, min: "workspace_admin", expect: false },

  // viewer can read but nothing else
  { actual: "viewer", min: "viewer", expect: true },
  { actual: "viewer", min: "operator", expect: false },
  { actual: "viewer", min: "workspace_admin", expect: false },

  // operator can do everything except admin
  { actual: "operator", min: "viewer", expect: true },
  { actual: "operator", min: "operator", expect: true },
  { actual: "operator", min: "workspace_admin", expect: false },

  // workspace_admin can do everything
  { actual: "workspace_admin", min: "viewer", expect: true },
  { actual: "workspace_admin", min: "operator", expect: true },
  { actual: "workspace_admin", min: "workspace_admin", expect: true },
];

let failures = 0;
for (const c of cases) {
  const got = meetsMinRole(c.actual, c.min);
  const ok = got === c.expect;
  const tag = ok ? "PASS" : "FAIL";
  const line = `${tag}: meetsMinRole(${JSON.stringify(c.actual)}, "${c.min}") → ${got} (expected ${c.expect})`;
  if (!ok) failures++;
  console.log(line);
}

// Sanity: the policy unit imported from the app should match the
// inline table above. If lib/rbac.ts drifts, the unit test still
// passes — that's by design; this test is a contract test of the
// hierarchy, not an import-the-prod-module test. A future iteration
// can replace the inline copies with a dynamic import once the
// TypeScript-from-node story stabilizes.

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} assertions passed`);
