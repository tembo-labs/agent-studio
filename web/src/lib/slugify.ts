// Slugs are the URL identifier for a workspace (`/{slug}`). Keeping them
// strict so reserved top-level routes (api, onboarding, _next, etc.) can
// coexist with user-chosen slugs without ambiguity.

const SLUG_MIN = 2;
const SLUG_MAX = 32;

// Top-level routes that must not collide with a workspace slug.
// Extend as new routes are added.
export const RESERVED_SLUGS = new Set<string>([
  "api",
  "mcp",
  "onboarding",
  "signin",
  "signout",
  "signup",
  "settings",
  "admin",
  "static",
  "public",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

/**
 * Convert free-form text into a URL-safe slug candidate. Does not enforce
 * length / reserved constraints — call `validateSlug` after.
 */
export function suggestSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
}

export type SlugValidationError =
  | "too-short"
  | "too-long"
  | "invalid-chars"
  | "reserved";

/**
 * Return null if the slug is valid; otherwise a machine-readable error code.
 */
export function validateSlug(slug: string): SlugValidationError | null {
  if (slug.length < SLUG_MIN) return "too-short";
  if (slug.length > SLUG_MAX) return "too-long";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "invalid-chars";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return null;
}
