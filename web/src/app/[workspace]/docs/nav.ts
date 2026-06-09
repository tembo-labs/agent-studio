// In-app docs navigation: the published user manual, organized into two
// audiences (Operators / Admins) that ALL users can browse. Page order mirrors
// the public Starlight sidebar (docs/astro.config.mjs); each slug maps to a
// page in the generated DOCS module (lib/docs-content.ts).

export type DocItem = { slug: string; label: string };
export type DocGroup = { label: string; items: DocItem[] };
export type DocSection = { audience: string; groups: DocGroup[] };

export const DOC_SECTIONS: DocSection[] = [
  {
    audience: "For Operators",
    groups: [
      {
        label: "Start here",
        items: [
          { slug: "introduction", label: "Introduction" },
          { slug: "getting-started", label: "Getting started" },
          { slug: "core-concepts", label: "Core concepts" },
        ],
      },
      {
        label: "Building agents",
        items: [
          { slug: "authoring-agents", label: "Authoring agents" },
          { slug: "agent-lifecycle", label: "Agent lifecycle" },
          { slug: "sidecar-python-tools", label: "Sidecar Python tools" },
        ],
      },
      {
        label: "Running & automating",
        items: [
          { slug: "running-agents", label: "Running agents" },
          { slug: "automations-triggers", label: "Automations & triggers" },
        ],
      },
      {
        label: "Connections & tools",
        items: [
          { slug: "connections", label: "Connections" },
          { slug: "tools-and-tool-uses", label: "Tools & Tool uses" },
        ],
      },
      {
        label: "Observability",
        items: [
          { slug: "dashboard-and-runs", label: "Dashboard & Runs" },
          { slug: "improvements", label: "Improvements" },
        ],
      },
      {
        label: "Help",
        items: [{ slug: "troubleshooting", label: "Troubleshooting" }],
      },
      {
        label: "Project",
        items: [
          { slug: "changelog", label: "Changelog" },
          { slug: "roadmap", label: "Roadmap" },
        ],
      },
    ],
  },
  {
    audience: "For Admins",
    groups: [
      {
        label: "Start here",
        items: [{ slug: "admin-introduction", label: "Introduction" }],
      },
      {
        label: "Workspace admin",
        items: [
          { slug: "settings", label: "Settings" },
          { slug: "audit-and-roles", label: "Audit & roles" },
          { slug: "slack-apps", label: "Slack apps" },
        ],
      },
      {
        label: "Self-hosting",
        items: [
          { slug: "customer-setup", label: "Setup checklist" },
          { slug: "deploy-railway", label: "Deploy on Railway" },
          { slug: "deploy-aws", label: "Deploy on AWS" },
          { slug: "deploy-vercel", label: "Deploy on Vercel" },
        ],
      },
    ],
  },
];

/** All slugs that appear in the nav, for internal-link rewriting. */
export const DOC_SLUGS: Set<string> = new Set(
  DOC_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => i.slug))),
);

/** The landing page — first item of the first group. */
export const DOC_HOME_SLUG = DOC_SECTIONS[0].groups[0].items[0].slug;

/** Label for a slug, for the page header / breadcrumbs. */
export function docLabel(slug: string): string | null {
  for (const s of DOC_SECTIONS) {
    for (const g of s.groups) {
      const item = g.items.find((i) => i.slug === slug);
      if (item) return item.label;
    }
  }
  return null;
}
