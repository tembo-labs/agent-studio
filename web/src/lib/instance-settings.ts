import "server-only";

import { db } from "@/lib/db";
import { getInstanceNameFromEnv } from "@/lib/config";

// Deployment-level settings, backed by the single-row `instance_settings`
// table (migration 0031). Reads fall back to env so an env-configured
// instance keeps working until an admin saves a value. Writes are gated
// to instance admins by the caller (see lib/instance.ts).

export type InstanceSettings = {
  instanceName: string;
};

/**
 * Resolved instance name: DB value if an admin has set one, else the
 * `TAS_INSTANCE_NAME` env fallback. Wrapped in try/catch so build-time
 * / no-DB contexts (and the brief window before migration 0031 runs)
 * degrade to the env value instead of throwing.
 */
export async function getInstanceName(): Promise<string> {
  try {
    const { rows } = await db.query<{ instance_name: string | null }>(
      "SELECT instance_name FROM instance_settings WHERE id = TRUE LIMIT 1",
    );
    const dbName = rows[0]?.instance_name?.trim();
    if (dbName) return dbName;
  } catch {
    // table missing / no DB — fall through to env.
  }
  return getInstanceNameFromEnv();
}

/**
 * The raw stored name (null if unset) — for the settings form, which
 * shows the env fallback as a placeholder rather than prefilling it.
 */
export async function getStoredInstanceName(): Promise<string | null> {
  try {
    const { rows } = await db.query<{ instance_name: string | null }>(
      "SELECT instance_name FROM instance_settings WHERE id = TRUE LIMIT 1",
    );
    return rows[0]?.instance_name?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * First run = no user accounts exist yet. While true, the pre-sign-in
 * setup screen may set the instance name (no admin to gate on yet). On a
 * DB error we return false — fail closed, don't open anonymous setup.
 */
export async function isFirstRun(): Promise<boolean> {
  try {
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM "user"`,
    );
    return (rows[0]?.n ?? "0") === "0";
  } catch {
    return false;
  }
}

/** Persist the instance name. Empty string clears it (→ env fallback).
 *  updatedBy is null for the pre-sign-in first-run setup (no user yet). */
export async function setInstanceName(
  name: string,
  updatedBy: string | null,
): Promise<void> {
  const trimmed = name.trim();
  await db.query(
    `UPDATE instance_settings
        SET instance_name = $1, updated_at = now(), updated_by = $2
      WHERE id = TRUE`,
    [trimmed || null, updatedBy],
  );
}
