import "server-only";

import { getServerSession } from "@/lib/session";

// Instance-admin policy. There is no scope-above-workspace concept in
// the DB yet (RBAC is workspace-scoped — see lib/rbac.ts), so instance
// admins are defined by an env allowlist: the operator who configures
// the deployment lists the admin emails alongside the other env.
//
// Mirrors lib/auth-server.ts `authorizeWorkspace` so instance-scoped
// routes/actions funnel through one gate.

export function getInstanceAdminEmails(): string[] {
  return (process.env.INSTANCE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isInstanceAdminEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return getInstanceAdminEmails().includes(email.trim().toLowerCase());
}

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
