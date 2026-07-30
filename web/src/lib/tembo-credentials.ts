import "server-only";

import { aadWorkspaceUserSecret } from "@/lib/crypto-aad";
import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";
import { db } from "@/lib/db";
import {
  getWorkspaceSecretPlaintext,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

const TEMBO_KEY_KIND = "tembo_api_key";

export type TemboAccountIdentity = {
  userId: string;
  orgId: string;
};

export type PersonalTemboPreview = TemboAccountIdentity & {
  last4: string;
  updatedAt: Date;
};

export type ResolvedTemboCredential = {
  apiKey: string;
  source: "personal" | "workspace_fallback";
};

export async function getPersonalTemboPreview(
  workspaceId: string,
  userId: string,
): Promise<PersonalTemboPreview | null> {
  const { rows } = await db.query<{
    last4: string;
    updated_at: Date;
    metadata: { temboUserId?: unknown; temboOrgId?: unknown };
  }>(
    `SELECT last4, updated_at, metadata
       FROM workspace_user_secret
      WHERE workspace_id = $1 AND user_id = $2 AND kind = $3`,
    [workspaceId, userId, TEMBO_KEY_KIND],
  );
  const row = rows[0];
  const temboUserId = row?.metadata?.temboUserId;
  const temboOrgId = row?.metadata?.temboOrgId;
  if (
    !row ||
    typeof temboUserId !== "string" ||
    typeof temboOrgId !== "string"
  ) {
    return null;
  }
  return {
    last4: row.last4,
    updatedAt: row.updated_at,
    userId: temboUserId,
    orgId: temboOrgId,
  };
}

async function getPersonalTemboApiKey(
  workspaceId: string,
  userId: string,
): Promise<string | null> {
  const { rows } = await db.query<{ ciphertext: Buffer }>(
    `SELECT ciphertext
       FROM workspace_user_secret
      WHERE workspace_id = $1 AND user_id = $2 AND kind = $3`,
    [workspaceId, userId, TEMBO_KEY_KIND],
  );
  if (!rows[0]) return null;
  return decryptSecret(
    rows[0].ciphertext,
    aadWorkspaceUserSecret(workspaceId, userId, TEMBO_KEY_KIND),
  );
}

export async function setPersonalTemboCredential(
  workspaceId: string,
  userId: string,
  apiKey: string,
  identity: TemboAccountIdentity,
): Promise<void> {
  const trimmed = apiKey.trim();
  const ciphertext = encryptSecret(
    trimmed,
    aadWorkspaceUserSecret(workspaceId, userId, TEMBO_KEY_KIND),
  );
  await db.query(
    `INSERT INTO workspace_user_secret
       (workspace_id, user_id, kind, ciphertext, last4, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (workspace_id, user_id, kind)
       DO UPDATE SET ciphertext = EXCLUDED.ciphertext,
                     last4 = EXCLUDED.last4,
                     metadata = EXCLUDED.metadata,
                     updated_at = NOW()`,
    [
      workspaceId,
      userId,
      TEMBO_KEY_KIND,
      ciphertext,
      last4(trimmed),
      JSON.stringify({
        temboUserId: identity.userId,
        temboOrgId: identity.orgId,
      }),
    ],
  );
}

export async function removePersonalTemboCredential(
  workspaceId: string,
  userId: string,
): Promise<void> {
  await db.query(
    `DELETE FROM workspace_user_secret
      WHERE workspace_id = $1 AND user_id = $2 AND kind = $3`,
    [workspaceId, userId, TEMBO_KEY_KIND],
  );
}

export async function resolveTemboCredential(
  workspaceId: string,
  actorUserId: string,
): Promise<ResolvedTemboCredential | null> {
  const personal = await getPersonalTemboApiKey(workspaceId, actorUserId);
  if (personal) return { apiKey: personal, source: "personal" };

  const fallbackPreview = await getWorkspaceSecretPreview(
    workspaceId,
    TEMBO_KEY_KIND,
  );
  if (!fallbackPreview) return null;

  return {
    apiKey: await getWorkspaceSecretPlaintext(workspaceId, TEMBO_KEY_KIND),
    source: "workspace_fallback",
  };
}

export async function isTemboConfiguredForUser(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  if (await getPersonalTemboPreview(workspaceId, userId)) return true;
  return (
    (await getWorkspaceSecretPreview(workspaceId, TEMBO_KEY_KIND)) !== null
  );
}
