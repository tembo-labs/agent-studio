import "server-only";

import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";
import { aadApiKeyToken } from "@/lib/crypto-aad";
import { db } from "@/lib/db";

// Per-user, workspace-bound API keys — the credential behind the public REST
// API (/api/v1) and the MCP server (/api/mcp). A key authenticates a caller as
// a specific (workspace, user) pair: the run executes AS user_id so the user's
// per-user connections apply, and the effective role is resolved live from
// workspace_member at request time (see api-auth.ts).
//
// Modeled on lib/webhooks-db.ts (same encrypt-at-rest + constant-time match),
// with one difference: a bearer arrives with no URL selector, so we can't
// decrypt-and-compare every row. We store token_lookup_hash = sha256(token)
// for an O(1) lookup, then still constant-time compare the decrypted
// ciphertext as defense in depth.

/** Masked, client-safe view — never carries the plaintext token. */
export type ApiKeyPreview = {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  tokenLast4: string;
  enabled: boolean;
  lastUsedAt: Date | null;
  createdBy: string;
  createdAt: Date;
};

/** Full row including the ciphertext — server-only, for token verification. */
export type ApiKeyRow = ApiKeyPreview & { tokenCiphertext: Buffer };

const PREVIEW_COLS = `id, workspace_id, user_id, name, token_last4, enabled,
  last_used_at, created_by, created_at`;

type PreviewDbRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  token_last4: string;
  enabled: boolean;
  last_used_at: Date | null;
  created_by: string;
  created_at: Date;
};

function toPreview(r: PreviewDbRow): ApiKeyPreview {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
    name: r.name,
    tokenLast4: r.token_last4,
    enabled: r.enabled,
    lastUsedAt: r.last_used_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

/** A fresh API token: URL-safe, high-entropy, with a `tas_` prefix so it's
 *  recognizable in a header. */
export function generateApiKey(): string {
  return `tas_${randomBytes(32).toString("base64url")}`;
}

/** Keyless sha256 (hex) of a token — the indexed lookup selector. Keyless so a
 *  lookup never has to decrypt; the master key only protects the at-rest copy. */
export function sha256Hex(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function listApiKeys(
  workspaceId: string,
): Promise<ApiKeyPreview[]> {
  const { rows } = await db.query<PreviewDbRow>(
    `SELECT ${PREVIEW_COLS}
       FROM workspace_api_key
      WHERE workspace_id = $1
      ORDER BY created_at ASC`,
    [workspaceId],
  );
  return rows.map(toPreview);
}

/**
 * Lookup by presented token (no workspace scope — the hash is globally unique
 * and is all the bearer carries). Returns the ciphertext so the caller can
 * constant-time verify. Returns null for an unknown token.
 */
export async function getApiKeyByToken(
  token: string,
): Promise<ApiKeyRow | null> {
  const { rows } = await db.query<PreviewDbRow & { token_ciphertext: Buffer }>(
    `SELECT ${PREVIEW_COLS}, token_ciphertext FROM workspace_api_key
      WHERE token_lookup_hash = $1`,
    [sha256Hex(token)],
  );
  const r = rows[0];
  if (!r) return null;
  return { ...toPreview(r), tokenCiphertext: r.token_ciphertext };
}

/** Constant-time check that a presented token matches the stored one. */
export function apiKeyTokenMatches(row: ApiKeyRow, presented: string): boolean {
  let stored: string;
  try {
    stored = decryptSecret(
      row.tokenCiphertext,
      aadApiKeyToken(row.workspaceId, row.id),
    );
  } catch {
    return false;
  }
  const a = Buffer.from(stored, "utf8");
  const b = Buffer.from(presented, "utf8");
  // timingSafeEqual throws on length mismatch — guard first (the length itself
  // isn't secret), then compare in constant time.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createApiKey(args: {
  workspaceId: string;
  userId: string;
  name: string;
  createdBy: string;
}): Promise<{ key: ApiKeyPreview; token: string }> {
  const token = generateApiKey();
  // Generate the id up front so the token AAD can bind to it at encrypt time.
  const id = randomUUID();
  const { rows } = await db.query<PreviewDbRow>(
    `INSERT INTO workspace_api_key
       (id, workspace_id, user_id, name, token_lookup_hash, token_ciphertext,
        token_last4, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${PREVIEW_COLS}`,
    [
      id,
      args.workspaceId,
      args.userId,
      args.name,
      sha256Hex(token),
      encryptSecret(token, aadApiKeyToken(args.workspaceId, id)),
      last4(token),
      args.createdBy,
    ],
  );
  return { key: toPreview(rows[0]), token };
}

/** Bump last_used_at. Fire-and-forget from the auth path — failures here must
 *  never block a request, so callers ignore the promise. */
export async function touchApiKeyLastUsed(id: string): Promise<void> {
  try {
    await db.query(
      `UPDATE workspace_api_key SET last_used_at = NOW() WHERE id = $1`,
      [id],
    );
  } catch {
    // Non-fatal: the row stays stale until the next successful touch.
  }
}

export async function setApiKeyEnabled(
  workspaceId: string,
  id: string,
  enabled: boolean,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE workspace_api_key
        SET enabled = $3, updated_at = NOW()
      WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id, enabled],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteApiKey(
  workspaceId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM workspace_api_key WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id],
  );
  return (rowCount ?? 0) > 0;
}
