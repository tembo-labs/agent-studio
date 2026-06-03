// The literal value that this module used to silently fall back to when
// BETTER_AUTH_SECRET was unset. It lives in the public repo, so anyone
// could use it to forge session tokens — it must be *rejected*, never
// accepted, as real signing material.
export const INSECURE_PLACEHOLDER_SECRET =
  "dev-only-insecure-secret-replace-via-env-BETTER_AUTH_SECRET";

// `next build` evaluates the auth module to collect page data with no
// runtime env present — notably no DATABASE_URL (see auth.ts). A real
// deployment always has DATABASE_URL, so its presence is our "we are
// serving requests" signal: at runtime a missing or placeholder secret
// must fail loudly instead of silently signing sessions with a value
// that's public in the repository.
type AuthSecretEnv = {
  BETTER_AUTH_SECRET?: string;
  DATABASE_URL?: string;
};

export function resolveAuthSecret(env?: AuthSecretEnv): string {
  const source = env ?? process.env;
  const secret = source.BETTER_AUTH_SECRET;
  if (secret && secret !== INSECURE_PLACEHOLDER_SECRET) return secret;
  if (source.DATABASE_URL != null) {
    throw new Error(
      "BETTER_AUTH_SECRET is missing or set to the insecure in-repo " +
        "placeholder. Generate a strong unique secret (openssl rand -base64 " +
        "32) and set it in the environment — refusing to sign sessions with " +
        "a public default.",
    );
  }
  return INSECURE_PLACEHOLDER_SECRET;
}
