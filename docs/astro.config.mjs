// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Published to GitHub Pages as a project site:
//   https://tembo.github.io/agent-studio/
// `site` + `base` make Starlight rewrite its own links for the base path.
// To move to a custom domain later: set `site` to the domain, `base` to
// "/", and add a public/CNAME file — nothing else changes.
export default defineConfig({
  site: "https://tembo.github.io",
  base: "/agent-studio",
  // No splash landing page — the site root sends visitors straight to the
  // Introduction. The redirect lives in src/pages/index.astro so it can use
  // the base-aware BASE_URL (an astro.config `redirects` destination is
  // literal and wouldn't include the /agent-studio base on the project site).
  integrations: [
    starlight({
      title: "Tembo Agent Studio",
      tagline: "Self-hosted control room for AI agents",
      favicon: "/favicon.svg",
      customCss: ["./src/styles/custom.css"],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/tembo/agent-studio",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/tembo/agent-studio/edit/main/docs/",
      },
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "introduction" },
            { label: "Getting started", slug: "getting-started" },
            { label: "Core concepts", slug: "core-concepts" },
          ],
        },
        {
          label: "Building agents",
          items: [
            { label: "Authoring agents", slug: "authoring-agents" },
            { label: "Agent lifecycle", slug: "agent-lifecycle" },
            { label: "Sidecar Python tools", slug: "sidecar-python-tools" },
          ],
        },
        {
          label: "Running & automating",
          items: [
            { label: "Running agents", slug: "running-agents" },
            { label: "Automations & triggers", slug: "automations-triggers" },
          ],
        },
        {
          label: "Integrations",
          items: [
            { label: "Connections", slug: "connections" },
            { label: "Tools & Tool uses", slug: "tools-and-tool-uses" },
            { label: "Slack apps", slug: "slack-apps" },
          ],
        },
        {
          label: "Observability & governance",
          items: [
            { label: "Dashboard & Runs", slug: "dashboard-and-runs" },
            { label: "Improvements", slug: "improvements" },
            { label: "Audit & roles", slug: "audit-and-roles" },
          ],
        },
        {
          label: "Administration",
          items: [
            { label: "Settings", slug: "settings" },
            { label: "Troubleshooting", slug: "troubleshooting" },
          ],
        },
        {
          label: "Self-hosting",
          items: [
            { label: "Admin introduction", slug: "admin-introduction" },
            { label: "Setup checklist", slug: "customer-setup" },
            { label: "Deploy on Railway", slug: "deploy-railway" },
            { label: "Deploy on AWS", slug: "deploy-aws" },
            { label: "Deploy on Vercel", slug: "deploy-vercel" },
          ],
        },
        {
          label: "Project",
          items: [
            { label: "Changelog", slug: "changelog" },
            { label: "Roadmap", slug: "roadmap" },
          ],
        },
      ],
    }),
  ],
});
