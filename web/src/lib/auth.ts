import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import { Pool } from "pg";

import { resolveAuthSecret } from "@/lib/auth-secret";
import { genericOAuthConfigs } from "@/lib/auth-providers";
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
// Never fall back to a usable default secret: a missing/placeholder secret
// at runtime would let anyone with the (public) repo forge sessions.
const secret = resolveAuthSecret();

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

// Microsoft (Entra ID) + generic OIDC both run through the genericOAuth
// plugin; Google stays a built-in social provider below.
const oauthConfigs = genericOAuthConfigs();

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
  plugins:
    oauthConfigs.length > 0
      ? [genericOAuth({ config: oauthConfigs })]
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
