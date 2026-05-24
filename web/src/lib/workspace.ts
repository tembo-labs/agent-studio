import "server-only";

import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";
import { db } from "@/lib/db";
import {
  parseRepoInput,
  validateRepo,
  type ValidateRepoError,
} from "@/lib/github";
import { suggestSlug, validateSlug } from "@/lib/slugify";

export type WorkspaceSecretKind =
  | "tembo_api_key"
  | "github_pat"
  | "anthropic_api_key";

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

// ── Workspace Git repo ───────────────────────────────────────────────────

export type WorkspaceRepo = {
  workspaceId: string;
  provider: "github";
  owner: string;
  name: string;
  defaultBranch: string;
  connectedAt: Date;
  connectedBy: string;
};

export async function getWorkspaceRepo(
  workspaceId: string,
): Promise<WorkspaceRepo | null> {
  const { rows } = await db.query<{
    workspace_id: string;
    provider: "github";
    owner: string;
    name: string;
    default_branch: string;
    connected_at: Date;
    connected_by: string;
  }>(
    `SELECT workspace_id, provider, owner, name, default_branch, connected_at, connected_by
       FROM workspace_repo
      WHERE workspace_id = $1`,
    [workspaceId],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    workspaceId: r.workspace_id,
    provider: r.provider,
    owner: r.owner,
    name: r.name,
    defaultBranch: r.default_branch,
    connectedAt: r.connected_at,
    connectedBy: r.connected_by,
  };
}

export type ConnectWorkspaceRepoError =
  | "unparseable-repo"
  | "missing-token"
  | ValidateRepoError;

export type ConnectWorkspaceRepoResult =
  | { ok: true; repo: WorkspaceRepo }
  | { ok: false; error: ConnectWorkspaceRepoError; detail?: string };

/**
 * Validate the PAT can read+write the repo (via GitHub API), then store
 * both the encrypted PAT and the resolved repo metadata atomically.
 * Replaces any prior repo connection on the workspace.
 */
export async function connectWorkspaceRepo(
  workspaceId: string,
  userId: string,
  input: { repo: string; token: string },
): Promise<ConnectWorkspaceRepoResult> {
  const token = input.token.trim();
  if (!token) return { ok: false, error: "missing-token" };

  const parsed = parseRepoInput(input.repo);
  if (!parsed) return { ok: false, error: "unparseable-repo" };

  const validation = await validateRepo(token, parsed);
  if (!validation.ok) {
    return { ok: false, error: validation.error, detail: validation.detail };
  }

  const ciphertext = encryptSecret(token);
  const tokenLast4 = last4(token);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO workspace_secret (workspace_id, kind, ciphertext, last4)
         VALUES ($1, 'github_pat', $2, $3)
         ON CONFLICT (workspace_id, kind)
         DO UPDATE SET ciphertext = EXCLUDED.ciphertext,
                       last4 = EXCLUDED.last4,
                       updated_at = NOW()`,
      [workspaceId, ciphertext, tokenLast4],
    );
    await client.query(
      `INSERT INTO workspace_repo
         (workspace_id, provider, owner, name, default_branch, connected_by)
         VALUES ($1, 'github', $2, $3, $4, $5)
         ON CONFLICT (workspace_id)
         DO UPDATE SET provider = EXCLUDED.provider,
                       owner = EXCLUDED.owner,
                       name = EXCLUDED.name,
                       default_branch = EXCLUDED.default_branch,
                       connected_by = EXCLUDED.connected_by,
                       connected_at = NOW()`,
      [workspaceId, validation.owner, validation.name, validation.defaultBranch, userId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const repo = await getWorkspaceRepo(workspaceId);
  if (!repo) throw new Error("workspace_repo disappeared after insert");
  return { ok: true, repo };
}

/**
 * Disconnect the repo: drops both the row and the encrypted PAT.
 */
export async function disconnectWorkspaceRepo(
  workspaceId: string,
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM workspace_repo WHERE workspace_id = $1`,
      [workspaceId],
    );
    await client.query(
      `DELETE FROM workspace_secret WHERE workspace_id = $1 AND kind = 'github_pat'`,
      [workspaceId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
