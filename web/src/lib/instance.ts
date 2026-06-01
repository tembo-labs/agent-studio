import "server-only";

import { getServerSession } from "@/lib/session";

// Instance-admin policy. There is no scope-above-workspace concept in
// the DB yet (RBAC is workspace-scoped — see lib/rbac.ts), so instance
// admins are defined by an env allowlist: the operator who configures
// the deployment lists the admin emails alongside the other env.
//
// The pure email checks live in lib/config (no session/DB deps) so the
// closed-instance account gate in lib/auth can use them without a cycle.
// Re-exported here so callers have one import for instance-admin logic.
// `authorizeInstance` adds the session-aware gate, mirroring
// lib/auth-server.ts `authorizeWorkspace`.
export { getInstanceAdminEmails, isInstanceAdminEmail } from "@/lib/config";
import { isInstanceAdminEmail } from "@/lib/config";

export type AuthorizeInstanceResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "no-session" | "denied" };

/**
 * Gate for instance-scoped (deployment-level) routes and actions.
 * Returns a discriminated union rather than throwing, matching
 * `authorizeWorkspace`. A denied non-admin is the caller's cue to
 * redirect away (don't leak the admin surface).
 */
export async function authorizeInstance(): Promise<AuthorizeInstanceResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, reason: "no-session" };
  if (!isInstanceAdminEmail(session.user.email)) {
    return { ok: false, reason: "denied" };
  }
  return { ok: true, userId: session.user.id, email: session.user.email };
}
