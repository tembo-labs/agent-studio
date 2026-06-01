import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { Pool } from "pg";

import { isInstanceAdminEmail } from "@/lib/config";
import {
  hasPendingInvite,
  resolvePendingInvitesForUser,
} from "@/lib/invitations";

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
  // Closed-instance gate. A new account may only be created for an
  // instance admin or an invited email — everyone else is rejected at
  // sign-up, so an uninvited person can't get into the instance at all.
  // Existing users (already have an account) are unaffected.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const allowed =
            isInstanceAdminEmail(user.email) ||
            (await hasPendingInvite(user.email));
          if (!allowed) {
            throw new APIError("FORBIDDEN", {
              message:
                "This instance is invite-only. Ask an admin to invite your email.",
            });
          }
          return { data: user };
        },
        // First sign-in: turn pending invites into memberships so the
        // user lands straight in their workspace(s).
        after: async (user) => {
          if (!user.email) return;
          try {
            await resolvePendingInvitesForUser(user.id, user.email);
          } catch (e) {
            console.error("[invites] resolve on signup failed:", e);
          }
        },
      },
    },
  },
});
