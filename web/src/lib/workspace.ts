import "server-only";

import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { suggestSlug, validateSlug } from "@/lib/slugify";

export type WorkspaceSecretKind = "tembo_api_key";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

function rowToWorkspace(row: {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listWorkspacesForUser(userId: string): Promise<Workspace[]> {
  const { rows } = await db.query<{
    id: string;
    name: string;
    slug: string;
    created_by: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT w.id, w.name, w.slug, w.created_by, w.created_at, w.updated_at
       FROM workspace w
       JOIN workspace_member m ON m.workspace_id = w.id
      WHERE m.user_id = $1
      ORDER BY w.created_at ASC`,
    [userId],
  );
  return rows.map(rowToWorkspace);
}

export async function getWorkspaceBySlug(
  slug: string,
): Promise<Workspace | null> {
  const { rows } = await db.query<{
    id: string;
    name: string;
    slug: string;
    created_by: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, name, slug, created_by, created_at, updated_at
       FROM workspace
      WHERE slug = $1
      LIMIT 1`,
    [slug],
  );
  return rows[0] ? rowToWorkspace(rows[0]) : null;
}

export async function userIsMember(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `SELECT 1 FROM workspace_member WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
    [workspaceId, userId],
  );
  return (rowCount ?? 0) > 0;
}

export type CreateWorkspaceResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; error: CreateWorkspaceError };

export type CreateWorkspaceError =
  | "name-required"
  | "slug-too-short"
  | "slug-too-long"
  | "slug-invalid-chars"
  | "slug-reserved"
  | "slug-taken";

/**
 * Create a workspace and add `userId` as its admin member, atomically.
 * Slug is auto-derived from the name when not provided.
 */
export async function createWorkspace(
  userId: string,
  input: { name: string; slug?: string },
): Promise<CreateWorkspaceResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "name-required" };

  const slug = (input.slug ?? suggestSlug(name)).trim();
  const slugError = validateSlug(slug);
  if (slugError) {
    return {
      ok: false,
      error: (`slug-${slugError}` as CreateWorkspaceError),
    };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Pre-check for taken slug to surface a clean error code instead of
    // a unique-violation exception bubble.
    const existing = await client.query(
      `SELECT 1 FROM workspace WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    if ((existing.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "slug-taken" };
    }

    const { rows } = await client.query<{
      id: string;
      name: string;
      slug: string;
      created_by: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO workspace (name, slug, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, slug, created_by, created_at, updated_at`,
      [name, slug, userId],
    );
    const workspace = rowToWorkspace(rows[0]);

    await client.query(
      `INSERT INTO workspace_member (workspace_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [workspace.id, userId],
    );

    await client.query("COMMIT");
    return { ok: true, workspace };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ── Workspace secrets ────────────────────────────────────────────────────

export type WorkspaceSecretPreview = {
  last4: string;
  updatedAt: Date;
};

export async function getWorkspaceSecretPreview(
  workspaceId: string,
  kind: WorkspaceSecretKind,
): Promise<WorkspaceSecretPreview | null> {
  const { rows } = await db.query<{ last4: string; updated_at: Date }>(
    `SELECT last4, updated_at
       FROM workspace_secret
      WHERE workspace_id = $1 AND kind = $2`,
    [workspaceId, kind],
  );
  if (!rows[0]) return null;
  return { last4: rows[0].last4, updatedAt: rows[0].updated_at };
}

/**
 * Returns the decrypted secret. Runtime use only — never serialize to a
 * client. Throws if the secret does not exist for (workspace, kind).
 */
export async function getWorkspaceSecretPlaintext(
  workspaceId: string,
  kind: WorkspaceSecretKind,
): Promise<string> {
  const { rows } = await db.query<{ ciphertext: Buffer }>(
    `SELECT ciphertext FROM workspace_secret WHERE workspace_id = $1 AND kind = $2`,
    [workspaceId, kind],
  );
  if (!rows[0]) {
    throw new Error(`workspace secret not found: ${kind}`);
  }
  return decryptSecret(rows[0].ciphertext);
}

export type SetWorkspaceSecretError =
  | "empty"
  | "too-short"
  | "too-long";

export type SetWorkspaceSecretResult =
  | { ok: true }
  | { ok: false; error: SetWorkspaceSecretError };

export async function setWorkspaceSecret(
  workspaceId: string,
  kind: WorkspaceSecretKind,
  plaintext: string,
): Promise<SetWorkspaceSecretResult> {
  const trimmed = plaintext.trim();
  if (trimmed.length === 0) return { ok: false, error: "empty" };
  // Conservative shape checks — keep the application from storing junk while
  // still tolerating whatever format Tembo issues today vs tomorrow.
  if (trimmed.length < 16) return { ok: false, error: "too-short" };
  if (trimmed.length > 512) return { ok: false, error: "too-long" };

  const ciphertext = encryptSecret(trimmed);
  await db.query(
    `INSERT INTO workspace_secret (workspace_id, kind, ciphertext, last4)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, kind)
       DO UPDATE SET ciphertext = EXCLUDED.ciphertext,
                     last4 = EXCLUDED.last4,
                     updated_at = NOW()`,
    [workspaceId, kind, ciphertext, last4(trimmed)],
  );
  return { ok: true };
}

export async function removeWorkspaceSecret(
  workspaceId: string,
  kind: WorkspaceSecretKind,
): Promise<void> {
  await db.query(
    `DELETE FROM workspace_secret WHERE workspace_id = $1 AND kind = $2`,
    [workspaceId, kind],
  );
}
