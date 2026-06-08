import "server-only";

import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";
import { db } from "@/lib/db";

// Bring-your-own OAuth app(s) for Native MCP providers that don't support DCR
// (HubSpot). Per-(workspace, provider, instance): an admin stores the OAuth
// app's client_id + client_secret, and the confidential authorize/callback/
// refresh flow uses them. A provider can have MORE THAN ONE instance (e.g. a
// HubSpot app per portal); `instance` is the slug a connection records so
// refresh presents the right secret. client_id is not secret; client_secret is
// AES-256-GCM encrypted with the shared master key (same as every other secret).

export const DEFAULT_INSTANCE = "default";

/** Masked, client-safe view — never carries the plaintext secret. */
export type NativeOAuthClientPreview = {
  provider: string;
  instance: string;
  label: string | null;
  clientId: string;
  secretLast4: string;
  updatedAt: string;
};

export async function getNativeOAuthClientPreview(
  workspaceId: string,
  provider: string,
  instance: string = DEFAULT_INSTANCE,
): Promise<NativeOAuthClientPreview | null> {
  const { rows } = await db.query<{
    provider: string;
    instance: string;
    label: string | null;
    client_id: string;
    secret_last4: string;
    updated_at: Date;
  }>(
    `SELECT provider, instance, label, client_id, secret_last4, updated_at
       FROM workspace_native_oauth_client
      WHERE workspace_id = $1 AND provider = $2 AND instance = $3`,
    [workspaceId, provider, instance],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    provider: r.provider,
    instance: r.instance,
    label: r.label,
    clientId: r.client_id,
    secretLast4: r.secret_last4,
    updatedAt: r.updated_at.toISOString(),
  };
}

/** All configured BYO client instances for a workspace (for the admin page). */
export async function listNativeOAuthClients(
  workspaceId: string,
): Promise<NativeOAuthClientPreview[]> {
  const { rows } = await db.query<{
    provider: string;
    instance: string;
    label: string | null;
    client_id: string;
    secret_last4: string;
    updated_at: Date;
  }>(
    `SELECT provider, instance, label, client_id, secret_last4, updated_at
       FROM workspace_native_oauth_client
      WHERE workspace_id = $1
      ORDER BY provider, instance`,
    [workspaceId],
  );
  return rows.map((r) => ({
    provider: r.provider,
    instance: r.instance,
    label: r.label,
    clientId: r.client_id,
    secretLast4: r.secret_last4,
    updatedAt: r.updated_at.toISOString(),
  }));
}

export async function upsertNativeOAuthClient(args: {
  workspaceId: string;
  provider: string;
  instance?: string;
  label?: string | null;
  clientId: string;
  clientSecret: string;
  userId: string;
}): Promise<void> {
  await db.query(
    `INSERT INTO workspace_native_oauth_client
       (workspace_id, provider, instance, label, client_id,
        client_secret_ciphertext, secret_last4, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (workspace_id, provider, instance)
       DO UPDATE SET label = EXCLUDED.label,
                     client_id = EXCLUDED.client_id,
                     client_secret_ciphertext = EXCLUDED.client_secret_ciphertext,
                     secret_last4 = EXCLUDED.secret_last4,
                     updated_at = NOW()`,
    [
      args.workspaceId,
      args.provider,
      args.instance ?? DEFAULT_INSTANCE,
      args.label?.trim() || null,
      args.clientId.trim(),
      encryptSecret(args.clientSecret),
      last4(args.clientSecret),
      args.userId,
    ],
  );
}

export async function deleteNativeOAuthClient(
  workspaceId: string,
  provider: string,
  instance: string = DEFAULT_INSTANCE,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM workspace_native_oauth_client
      WHERE workspace_id = $1 AND provider = $2 AND instance = $3`,
    [workspaceId, provider, instance],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * The stored client_id + decrypted client_secret for a BYO provider instance.
 * Used by the OAuth callback's confidential token exchange. Server-only; never
 * returned to the browser. Null when the instance isn't configured.
 */
export async function getNativeOAuthClientSecret(
  workspaceId: string,
  provider: string,
  instance: string = DEFAULT_INSTANCE,
): Promise<{ clientId: string; clientSecret: string } | null> {
  const { rows } = await db.query<{
    client_id: string;
    client_secret_ciphertext: Buffer;
  }>(
    `SELECT client_id, client_secret_ciphertext
       FROM workspace_native_oauth_client
      WHERE workspace_id = $1 AND provider = $2 AND instance = $3`,
    [workspaceId, provider, instance],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    clientId: r.client_id,
    clientSecret: decryptSecret(r.client_secret_ciphertext),
  };
}
