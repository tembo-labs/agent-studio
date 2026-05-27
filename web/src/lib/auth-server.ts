import "server-only";

import {
  meetsMinRole,
  type WorkspaceRole,
} from "@/lib/rbac";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceBySlug,
  getWorkspaceRole,
  type Workspace,
} from "@/lib/workspace";

// Shared workspace authorization helper (US-0.4-02). Every server
// action and API route that touches a workspace funnels through
// here so the RBAC policy lives in one place.
//
// Returns a discriminated union rather than throwing because Next.js
// server actions don't have a clean error-recovery path — the caller
// decides whether to map a denied auth to a 404 (default — don't
// leak workspace existence), a form-state error, or a 403 response.
//
// minRole defaults to 'viewer' so a caller that just needs "any
// member" can omit the second argument.

export type AuthorizeWorkspaceFailure =
  | { ok: false; reason: "no-session" }
  | { ok: false; reason: "no-workspace" }
  | { ok: false; reason: "denied"; actual: WorkspaceRole | null };

export type AuthorizeWorkspaceSuccess = {
  ok: true;
  workspace: Workspace;
  userId: string;
  role: WorkspaceRole;
};

export type AuthorizeWorkspaceResult =
  | AuthorizeWorkspaceSuccess
  | AuthorizeWorkspaceFailure;

export async function authorizeWorkspace(
  slug: string,
  minRole: WorkspaceRole = "viewer",
): Promise<AuthorizeWorkspaceResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, reason: "no-session" };

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { ok: false, reason: "no-workspace" };

  const role = await getWorkspaceRole(workspace.id, session.user.id);
  if (!meetsMinRole(role, minRole)) {
    return { ok: false, reason: "denied", actual: role };
  }

  return {
    ok: true,
    workspace,
    userId: session.user.id,
    role: role as WorkspaceRole,
  };
}

/**
 * One-line message for the "denied" branch — keeps action error
 * surfaces consistent so the UI doesn't have to invent its own copy.
 */
export const DENIED_MESSAGE =
  "You don't have permission to do that. Ask a workspace admin to upgrade your role.";
