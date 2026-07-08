// Client-safe favicon constants. Kept separate from `lib/workspace.ts`
// (which is server-only because it imports the Postgres pool) so client
// components can render the picker without dragging pg into the bundle.

export const FAVICON_KINDS = [
  "default-tembo",
  "default-agent",
  "default-bolt",
  "default-cube",
  "custom",
] as const;
export type FaviconKind = (typeof FAVICON_KINDS)[number];

export const DEFAULT_FAVICON_KINDS = FAVICON_KINDS.filter(
  (k): k is Exclude<FaviconKind, "custom"> => k !== "custom",
);

// Version of the static SVG artwork under /public/favicons/. Bump when
// the artwork changes: browsers cache favicons per-URL hard (a hard
// refresh won't clear them), so every URL that ultimately serves a
// default icon — root layout <link>, workspace favicon <link>, and the
// favicon route's redirect target — carries this in a `?v=` param to
// force a refetch. v3: new Tembo T mark.
export const FAVICON_ASSET_VERSION = 3;

export const FAVICON_LABELS: Record<FaviconKind, string> = {
  "default-tembo": "Tembo",
  "default-agent": "Agent",
  "default-bolt": "Bolt",
  "default-cube": "Cube",
  custom: "Custom",
};
