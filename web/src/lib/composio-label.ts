// Client-safe label helper for Composio toolkit slugs. Lives in its
// own module — without "server-only" and without the @composio/core
// SDK — so client components (Tools table, etc.) can import it
// without dragging the whole composio.ts surface into the browser
// bundle.

/**
 * Curated display labels for the toolkits we surface most often.
 * Anything not in the table falls back to title-casing the slug
 * (see toolkitLabel). Exported so the "Add another" form on
 * Connections can populate its toolkit autocomplete from the same
 * source of truth.
 */
export const COMPOSIO_TOOLKIT_LABEL_OVERRIDES: Record<string, string> = {
  slack: "Slack",
  googlesheets: "Google Sheets",
  gmail: "Gmail",
  googlecalendar: "Google Calendar",
  googledrive: "Google Drive",
  googledocs: "Google Docs",
  notion: "Notion",
  github: "GitHub",
  linear: "Linear",
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  airtable: "Airtable",
  asana: "Asana",
  jira: "Jira",
};

export function toolkitLabel(slug: string): string {
  const override = COMPOSIO_TOOLKIT_LABEL_OVERRIDES[slug.toLowerCase()];
  if (override) return override;
  // Fallback: title-case the slug. "gmail" → "Gmail", "google_sheets"
  // → "Google Sheets". Composio slugs are usually lowercase + no
  // separator, so this is approximate; users can ask us to add an
  // override entry if a slug renders ugly.
  return slug
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
