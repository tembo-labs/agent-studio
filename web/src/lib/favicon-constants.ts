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

export const FAVICON_LABELS: Record<FaviconKind, string> = {
  "default-tembo": "Tembo",
  "default-agent": "Agent",
  "default-bolt": "Bolt",
  "default-cube": "Cube",
  custom: "Custom",
};
