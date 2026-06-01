import "server-only";

import { db } from "@/lib/db";
import { isWorkspaceRole, type WorkspaceRole } from "@/lib/rbac";

// Workspace invitations for the invite-only instance. A workspace admin
// creates a pending invite (email + role); the invitee joins on their
// first sign-in, matched by email. The closed-instance account gate
// (lib/auth.ts) uses hasPendingInvite to decide who may sign up at all.

export type PendingInvitation = {
  id: string;
  email: string;
  role: WorkspaceRole;
  invitedByName: string | null;
  createdAt: Date;
};

export type CreateInvitationError =
  | "bad-email"
  | "bad-role"
  | "already-member"
  | "already-invited";

export type CreateInvitationResult =
  | { ok: true; invitation: PendingInvitation }
  | { ok: false; error: CreateInvitationError };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function createInvitation(
  workspaceId: string,
  emailRaw: string,
  role: string,
  invitedBy: string,
): Promise<CreateInvitationResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "bad-email" };
  if (!isWorkspaceRole(role)) return { ok: false, error: "bad-role" };

  // Already a member of this workspace (by email → user → membership)?
  const member = await db.query(
    `SELECT 1 FROM workspace_member m
       JOIN "user" u ON u.id = m.user_id
      WHERE m.workspace_id = $1 AND lower(u.email) = $2 LIMIT 1`,
    [workspaceId, email],
  );
  if ((member.rowCount ?? 0) > 0) return { ok: false, error: "already-member" };

  // Already has a pending invite to this workspace?
  const pending = await db.query(
    `SELECT 1 FROM workspace_invitation
      WHERE workspace_id = $1 AND lower(email) = $2 AND accepted_at IS NULL LIMIT 1`,
    [workspaceId, email],
  );
  if ((pending.rowCount ?? 0) > 0) {
    return { ok: false, error: "already-invited" };
  }

  const { rows } = await db.query<{ id: string; created_at: Date }>(
    `INSERT INTO workspace_invitation (workspace_id, email, role, invited_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [workspaceId, email, role, invitedBy],
  );
  return {
    ok: true,
    invitation: {
      id: rows[0].id,
      email,
      role: role as WorkspaceRole,
      invitedByName: null,
      createdAt: rows[0].created_at,
    },
  };
}

export async function listPendingInvitations(
  workspaceId: string,
): Promise<PendingInvitation[]> {
  const { rows } = await db.query<{
    id: string;
    email: string;
    role: string;
    created_at: Date;
    invited_by_name: string | null;
  }>(
    `SELECT i.id, i.email, i.role, i.created_at, u.name AS invited_by_name
       FROM workspace_invitation i
       LEFT JOIN "user" u ON u.id = i.invited_by
      WHERE i.workspace_id = $1 AND i.accepted_at IS NULL
      ORDER BY i.created_at DESC`,
    [workspaceId],
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role as WorkspaceRole,
    invitedByName: r.invited_by_name,
    createdAt: r.created_at,
  }));
}

export async function revokeInvitation(
  id: string,
  workspaceId: string,
): Promise<boolean> {
  const res = await db.query(
    `DELETE FROM workspace_invitation
      WHERE id = $1 AND workspace_id = $2 AND accepted_at IS NULL`,
    [id, workspaceId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Closed-instance gate input: does any pending invite match this email? */
export async function hasPendingInvite(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  const { rowCount } = await db.query(
    `SELECT 1 FROM workspace_invitation
      WHERE lower(email) = lower($1) AND accepted_at IS NULL LIMIT 1`,
    [email],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * On first sign-in, turn this user's pending invites into memberships.
 * Idempotent: re-running adds nothing (membership upsert + invite marked
 * accepted). Returns how many workspaces were joined.
 */
export async function resolvePendingInvitesForUser(
  userId: string,
  email: string,
): Promise<number> {
  const e = email.trim().toLowerCase();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      id: string;
      workspace_id: string;
      role: string;
    }>(
      `SELECT id, workspace_id, role FROM workspace_invitation
        WHERE lower(email) = $1 AND accepted_at IS NULL
        FOR UPDATE`,
      [e],
    );
    let joined = 0;
    for (const inv of rows) {
      await client.query(
        `INSERT INTO workspace_member (workspace_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (workspace_id, user_id) DO NOTHING`,
        [inv.workspace_id, userId, inv.role],
      );
      await client.query(
        `UPDATE workspace_invitation
            SET accepted_at = now(), accepted_by = $2
          WHERE id = $1`,
        [inv.id, userId],
      );
      joined += 1;
    }
    await client.query("COMMIT");
    return joined;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
