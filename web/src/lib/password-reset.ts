import "server-only";

import { randomBytes } from "crypto";

import { db } from "@/lib/db";

// Admin-minted password reset links for email/password instances. TAS is
// SMTP-free, so "forgot password" is admin-driven: a workspace admin
// generates a one-time link and hands it to the member out-of-band (the
// same trust path as the copy-paste invite template).
//
// The token row is written in exactly the shape better-auth's own
// `requestPasswordReset` produces (verification row with identifier
// `reset-password:<token>`, value = user id), so the stock
// `POST /api/auth/reset-password` endpoint consumes it — we only mint,
// better-auth validates, expires, single-uses, and (per
// `revokeSessionsOnPasswordReset` in lib/auth.ts) revokes sessions.

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, better-auth's own default

export function resetPasswordPath(token: string): string {
  return `/reset-password?token=${encodeURIComponent(token)}`;
}

export async function createPasswordResetToken(
  userId: string,
  ttlMs: number = RESET_TOKEN_TTL_MS,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.query(
    `INSERT INTO verification (id, identifier, value, "expiresAt")
     VALUES ($1, $2, $3, $4)`,
    [randomBytes(16).toString("base64url"), `reset-password:${token}`, userId, expiresAt],
  );
  return { token, expiresAt };
}
