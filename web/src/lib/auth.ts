import { betterAuth } from "better-auth";
import { Pool } from "pg";

// We intentionally do not throw on missing env at module load time:
// Next.js evaluates this file during `next build` to collect page data,
// and the build environment legitimately has no DATABASE_URL. Misconfigured
// runtimes will fail loudly on the first request instead.
const databaseUrl = process.env.DATABASE_URL ?? "postgres://placeholder";
const secret =
  process.env.BETTER_AUTH_SECRET ??
  "dev-only-insecure-secret-replace-via-env-BETTER_AUTH_SECRET";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: new Pool({ connectionString: databaseUrl }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: { enabled: false },
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : undefined,
});
