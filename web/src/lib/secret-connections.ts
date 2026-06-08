import "server-only";

import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";
import { db } from "@/lib/db";

// Secrets — the 3rd connection substrate. Free-form, per-WORKSPACE API keys
// (e.g. Clay) that sidecar Python tools read via tas_tools.secret("<slug>").
//
// Distinct from the enumerated `workspace_secret` provider-key store
// (lib/workspace.ts `setWorkspaceSecret`) and from the per-user OAuth
// connections (lib/connections.ts): a Secret is one org-wide value an admin
// sets once. Row identity is (workspace_id, slug); the value is encrypted
// with the same AES-256-GCM master key as every other secret.

/** Slug charset: a safe identifier the agent copies verbatim. */
const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;

export function isValidSecretSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 64 && SLUG_RE.test(slug);
}

/** Masked, client-safe view of a Secret — never carries the plaintext. */
export type SecretConnectionPreview = {
  slug: string;
  description: string | null;
  last4: string;
  updatedAt: string;
};

type Row = {
  slug: string;
  description: string | null;
  last4: string;
  updated_at: Date;
};

export async function listSecretConnections(
  workspaceId: string,
): Promise<SecretConnectionPreview[]> {
  const { rows } = await db.query<Row>(
    `SELECT slug, description, last4, updated_at
       FROM workspace_secret_connection
      WHERE workspace_id = $1
      ORDER BY slug`,
    [workspaceId],
  );
  return rows.map((r) => ({
    slug: r.slug,
    description: r.description,
    last4: r.last4,
    updatedAt: r.updated_at.toISOString(),
  }));
}

export type UpsertSecretResult =
  | { ok: true; rotated: boolean }
  | { ok: false; error: "bad-slug" | "empty-value" };

/**
 * Insert or rotate a Secret. On (workspace_id, slug) conflict the value +
 * description are replaced. Encrypts with the shared master key and keeps
 * last4 in cleartext for the masked preview.
 */
export async function upsertSecretConnection(args: {
  workspaceId: string;
  slug: string;
  value: string;
  description: string | null;
  userId: string;
}): Promise<UpsertSecretResult> {
  const slug = args.slug.trim().toLowerCase();
  if (!isValidSecretSlug(slug)) return { ok: false, error: "bad-slug" };
  const value = args.value;
  if (!value) return { ok: false, error: "empty-value" };

  const { rows: existingRows } = await db.query<{ exists: number }>(
    `SELECT 1 AS exists
       FROM workspace_secret_connection
      WHERE workspace_id = $1 AND slug = $2
      LIMIT 1`,
    [args.workspaceId, slug],
  );
  const existed = existingRows.length > 0;

  const ciphertext = encryptSecret(value);
  await db.query(
    `INSERT INTO workspace_secret_connection
       (workspace_id, slug, description, ciphertext, last4, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (workspace_id, slug)
       DO UPDATE SET description = EXCLUDED.description,
                     ciphertext  = EXCLUDED.ciphertext,
                     last4       = EXCLUDED.last4,
                     updated_at  = NOW()`,
    [
      args.workspaceId,
      slug,
      args.description?.trim() || null,
      ciphertext,
      last4(value),
      args.userId,
    ],
  );
  return { ok: true, rotated: existed };
}

export async function deleteSecretConnection(
  workspaceId: string,
  slug: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM workspace_secret_connection
      WHERE workspace_id = $1 AND slug = $2`,
    [workspaceId, slug],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Decrypt a single Secret's value. Server-only; never returned to the
 * browser. (Runtime injection happens in Rust; this exists for any
 * server-side use that needs the plaintext.)
 */
export async function getSecretConnectionValue(
  workspaceId: string,
  slug: string,
): Promise<string | null> {
  const { rows } = await db.query<{ ciphertext: Buffer }>(
    `SELECT ciphertext FROM workspace_secret_connection
      WHERE workspace_id = $1 AND slug = $2`,
    [workspaceId, slug],
  );
  if (rows.length === 0) return null;
  return decryptSecret(rows[0].ciphertext);
}
