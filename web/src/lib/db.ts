import "server-only";
import { Pool } from "pg";

// Single shared Pool across server-side modules. better-auth uses its own
// Pool (passed in via the auth config), so the connection budget below is
// for workspace / agent / run queries only.
const globalForPool = globalThis as unknown as { tasPgPool?: Pool };

export const db: Pool =
  globalForPool.tasPgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://placeholder",
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPool.tasPgPool = db;
}
