// Generate TS catalog entries + Rust allowlist tuples from deep-probe JSON.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

// slug, displayName, mode: dcr|manual|pat, cat (docs grouping), note (comment line(s))
const M = [
  // ── Sales / GTM ──
  ["outreach", "Outreach", "dcr", "sales", "Requires a licensed seat with the Amplify add-on; connects fine, tools 403 without it."],
  ["salesloft", "Salesloft", "dcr", "sales", "Requires the Salesloft Agentic add-on (admin-enabled)."],
  ["zoominfo", "ZoomInfo", "dcr", "sales", ""],
  ["lusha", "Lusha", "dcr", "sales", ""],
  ["hunter", "Hunter", "dcr", "sales", ""],
  ["instantly", "Instantly", "dcr", "sales", ""],
  ["crossbeam", "Crossbeam", "dcr", "sales", "MCP endpoint is the origin root (like Pylon)."],
  ["harmonic", "Harmonic", "dcr", "sales", "MCP endpoint is the origin root (like Pylon)."],
  ["chilipiper", "Chili Piper", "dcr", "sales", ""],
  ["dayai", "Day AI", "dcr", "sales", ""],
  ["clarify", "Clarify", "dcr", "sales", ""],
  ["staircase", "Staircase AI", "dcr", "sales", "Gainsight's customer-intelligence product."],
  // ── Support / CX / research ──
  ["zendesk", "Zendesk", "dcr", "support", "Live with DCR but Zendesk's own comms describe MCP as early-access — expect account gating."],
  ["helpscout", "Help Scout", "dcr", "support", "Beta endpoint (mcp.helpscout.net)."],
  ["gorgias", "Gorgias", "dcr", "support", ""],
  ["plain", "Plain", "dcr", "support", ""],
  ["lorikeet", "Lorikeet", "dcr", "support", ""],
  ["unthread", "Unthread", "dcr", "support", ""],
  ["enterpret", "Enterpret", "dcr", "support", ""],
  ["dovetail", "Dovetail", "dcr", "support", ""],
  ["missive", "Missive", "dcr", "support", ""],
  // ── Meetings ──
  ["otter", "Otter.ai", "dcr", "meetings", ""],
  ["grain", "Grain", "dcr", "meetings", ""],
  ["krisp", "Krisp", "dcr", "meetings", ""],
  ["circleback", "Circleback", "dcr", "meetings", ""],
  ["tldv", "tl;dv", "dcr", "meetings", ""],
  // ── Finance / spend / payments ──
  ["ramp", "Ramp", "dcr", "finance", "Write actions (approve reimbursements, edit txns) honor Ramp's admin access controls."],
  ["brex", "Brex", "dcr", "finance", ""],
  ["mercury", "Mercury", "dcr", "finance", ""],
  ["expensify", "Expensify", "dcr", "finance", ""],
  ["navan", "Navan", "dcr", "finance", ""],
  ["carta", "Carta", "dcr", "finance", ""],
  ["digits", "Digits", "dcr", "finance", ""],
  ["gocardless", "GoCardless", "dcr", "finance", ""],
  ["mercadopago", "Mercado Pago", "dcr", "finance", ""],
  // ── Financial / market intelligence ──
  ["pitchbook", "PitchBook", "dcr", "finintel", "Requires a PitchBook Premium seat."],
  ["morningstar", "Morningstar", "dcr", "finintel", ""],
  ["cbinsights", "CB Insights", "dcr", "finintel", ""],
  ["quartr", "Quartr", "dcr", "finintel", ""],
  ["daloopa", "Daloopa", "dcr", "finintel", ""],
  ["consensus", "Consensus", "dcr", "finintel", "Scientific-paper search/synthesis."],
  // ── HR / recruiting / learning ──
  ["gusto", "Gusto", "dcr", "hr", "Read-only tools; OAuth scoped by data category."],
  ["deel", "Deel", "dcr", "hr", ""],
  ["ashby", "Ashby", "dcr", "hr", ""],
  ["workable", "Workable", "dcr", "hr", ""],
  ["metaview", "Metaview", "dcr", "hr", ""],
  ["indeed", "Indeed", "dcr", "hr", ""],
  ["udemy", "Udemy Business", "dcr", "hr", ""],
  // ── Legal / compliance ──
  ["signnow", "SignNow", "dcr", "legal", ""],
  ["vanta", "Vanta", "dcr", "legal", ""],
  ["drata", "Drata", "dcr", "legal", ""],
  // ── Productivity / PM / design ──
  ["figma", "Figma", "dcr", "productivity", "All plans; Starter/view-only seats are capped at ~6 tool calls/month."],
  ["miro", "Miro", "dcr", "productivity", "Beta; Enterprise teams need admin enablement. MCP endpoint is the origin root."],
  ["lucid", "Lucid", "dcr", "productivity", ""],
  ["productboard", "Productboard", "dcr", "productivity", ""],
  ["aha", "Aha!", "dcr", "productivity", ""],
  ["shortcut", "Shortcut", "dcr", "productivity", ""],
  ["todoist", "Todoist", "dcr", "productivity", ""],
  ["teamwork", "Teamwork", "dcr", "productivity", "MCP endpoint is the origin root."],
  ["calendly", "Calendly", "dcr", "productivity", "MCP endpoint is the origin root; works on free plans."],
  ["superhuman", "Superhuman Mail", "dcr", "productivity", ""],
  ["craft", "Craft", "dcr", "productivity", ""],
  ["mem", "Mem", "dcr", "productivity", ""],
  ["gamma", "Gamma", "dcr", "productivity", ""],
  ["pitch", "Pitch", "dcr", "productivity", ""],
  ["eraser", "Eraser", "dcr", "productivity", ""],
  ["jotform", "Jotform", "dcr", "productivity", ""],
  ["typeform", "Typeform", "dcr", "productivity", "US endpoint; EU accounts use api.eu.typeform.com (not cataloged yet)."],
  ["surveymonkey", "SurveyMonkey", "dcr", "productivity", ""],
  ["egnyte", "Egnyte", "dcr", "productivity", ""],
  // ── Marketing / content / CMS ──
  ["mailchimp", "Mailchimp", "dcr", "marketing", ""],
  ["customerio", "Customer.io", "dcr", "marketing", ""],
  ["ahrefs", "Ahrefs", "dcr", "marketing", ""],
  ["semrush", "Semrush", "dcr", "marketing", ""],
  ["cloudinary", "Cloudinary", "dcr", "marketing", "Asset-management server (their MCP suite has several; this is the primary)."],
  ["contentful", "Contentful", "dcr", "marketing", ""],
  ["sanity", "Sanity", "dcr", "marketing", ""],
  ["wix", "Wix", "dcr", "marketing", ""],
  ["wordpress", "WordPress.com", "dcr", "marketing", "WordPress.com-hosted sites only (public-api.wordpress.com), not self-hosted WP."],
  ["gitbook", "GitBook", "dcr", "marketing", ""],
  ["mintlify", "Mintlify", "dcr", "marketing", ""],
  ["deepl", "DeepL", "dcr", "marketing", "Seat-based plans; fair-usage limits."],
  // ── Dev / infra / observability ──
  ["gitlab", "GitLab", "dcr", "dev", "gitlab.com only; self-managed instances would need an instance-based entry."],
  ["supabase", "Supabase", "dcr", "dev", "Supports ?read_only=true and ?project_ref= query params on the MCP URL."],
  ["netlify", "Netlify", "dcr", "dev", ""],
  ["heroku", "Heroku", "dcr", "dev", ""],
  ["buildkite", "Buildkite", "dcr", "dev", "A read-only variant exists at /mcp/readonly."],
  ["grafana", "Grafana", "dcr", "dev", "Grafana Cloud only (self-hosted OSS uses a local server)."],
  ["newrelic", "New Relic", "dcr", "dev", "US endpoint; EU is mcp.eu.newrelic.com. Not permitted for FedRAMP/HIPAA accounts."],
  ["honeycomb", "Honeycomb", "dcr", "dev", "Requires Honeycomb Intelligence enabled; EU is mcp.eu1.honeycomb.io."],
  ["incidentio", "incident.io", "dcr", "dev", ""],
  ["rootly", "Rootly", "dcr", "dev", "SSE endpoint (/sse) — no streamable-http path advertised."],
  ["bugsnag", "BugSnag", "dcr", "dev", ""],
  ["launchdarkly", "LaunchDarkly", "dcr", "dev", "Product-area servers under /mcp/{area}; this is the core flags server. EU/federal instances unsupported."],
  ["planetscale", "PlanetScale", "dcr", "dev", ""],
  ["prisma", "Prisma Postgres", "dcr", "dev", ""],
  ["instantdb", "InstantDB", "dcr", "dev", ""],
  ["algolia", "Algolia", "dcr", "dev", ""],
  ["statsig", "Statsig", "dcr", "dev", ""],
  ["postman", "Postman", "dcr", "dev", "A trimmed tool surface exists at /minimal."],
  ["semgrep", "Semgrep", "dcr", "dev", ""],
  ["workos", "WorkOS", "dcr", "dev", ""],
  ["stytch", "Stytch", "dcr", "dev", "Auth server is a per-tenant customers.stytch.com origin (their own DCR tenant)."],
  ["mux", "Mux", "dcr", "dev", "MCP endpoint is the origin root."],
  ["knock", "Knock", "dcr", "dev", ""],
  ["lovable", "Lovable", "dcr", "dev", "MCP endpoint is the origin root."],
  ["retool", "Retool", "dcr", "dev", ""],
  ["telnyx", "Telnyx", "dcr", "dev", ""],
  ["jam", "Jam", "dcr", "dev", ""],
  ["globalping", "Globalping", "dcr", "dev", ""],
  // ── Data / AI ──
  ["airbyte", "Airbyte", "dcr", "data", "Airbyte Agents account (app.airbyte.ai)."],
  ["motherduck", "MotherDuck", "dcr", "data", ""],
  ["montecarlo", "Monte Carlo", "dcr", "data", ""],
  ["atlan", "Atlan", "dcr", "data", ""],
  ["huggingface", "Hugging Face", "dcr", "data", ""],
  // ── Automation / web data / search ──
  ["zapier", "Zapier", "dcr", "automation", "Proxies 9k+ app actions; users curate the tool list at mcp.zapier.com."],
  ["make", "Make", "dcr", "automation", "MCP endpoint is the origin root."],
  ["ifttt", "IFTTT", "dcr", "automation", ""],
  ["exa", "Exa", "dcr", "automation", ""],
  ["tavily", "Tavily", "dcr", "automation", ""],
  ["firecrawl", "Firecrawl", "dcr", "automation", ""],
  ["apify", "Apify", "dcr", "automation", "MCP endpoint is the origin root."],
  ["brightdata", "Bright Data", "dcr", "automation", ""],
  // ── Manual (BYO OAuth app) ──
  ["docusign", "DocuSign", "manual", "manual", "Open beta; confidential authorization-code clients only (no DCR)."],
  ["xero", "Xero", "manual", "manual", "Standard Xero OAuth app (no DCR)."],
  ["front", "Front", "manual", "manual", "Open beta; create a Front developer OAuth app (confidential)."],
  ["smartsheet", "Smartsheet", "manual", "manual", ""],
  ["mongodb", "MongoDB Atlas", "manual", "manual", ""],
  ["circleci", "CircleCI", "manual", "manual", ""],
  ["chargebee", "Chargebee", "manual", "manual", "Central endpoint; Chargebee also hosts per-site custom servers (not cataloged)."],
  ["bigquery", "BigQuery", "manual", "manual", "Google OAuth like Gmail: manual confidential client + offline access params."],
  ["ironclad", "Ironclad", "manual", "manual", "NA1 region endpoint."],
  ["harvey", "Harvey", "manual", "manual", ""],
  ["tableau", "Tableau", "manual", "manual", "Tableau Cloud only; rolling out through 2026.2."],
  ["shopify", "Shopify", "manual", "manual", "Admin setup server; per-store storefront MCP is separate and unauthenticated."],
];

const deep = {};
for (const f of readdirSync("deep")) {
  const j = JSON.parse(readFileSync(`deep/${f}`, "utf8"));
  deep[j.slug] = j;
}

const orig = (u) => (u ? u.match(/^https:\/\/[^/]+/)[0] : null);
const originsFor = (d) => {
  const set = new Set();
  for (const a of d.authorization_servers || []) set.add(orig(a));
  for (const k of ["authorize_origin", "token_origin", "registration_origin"]) if (d[k]) set.add(d[k]);
  set.delete(null);
  return [...set].sort();
};

const wrap = (text, prefix) =>
  text.length === 0 ? [] : text.match(/.{1,72}(\s|$)/g).map((l) => `${prefix}${l.trim()}`);

let union = [];
let entries = [];
let rust = [];
const sections = {
  sales: "Sales / GTM", support: "Support / CX", meetings: "Meeting intelligence",
  finance: "Finance / spend / payments", finintel: "Financial & market intelligence",
  hr: "HR / recruiting / learning", legal: "Legal / compliance",
  productivity: "Productivity / PM / design", marketing: "Marketing / content / CMS",
  dev: "Dev / infra / observability", data: "Data / AI",
  automation: "Automation / web data / search", manual: "Bring-your-own OAuth app (no DCR)",
};
let lastCat = null;
const mcpOrigins = new Set();
for (const [slug, name, mode, cat, note] of M) {
  const d = deep[slug];
  if (!d) throw new Error(`no probe data for ${slug}`);
  const origins = originsFor(d);
  const mcpOrigin = orig(d.url);
  if (mcpOrigins.has(mcpOrigin)) console.error(`WARN duplicate mcp origin ${mcpOrigin} (${slug})`);
  mcpOrigins.add(mcpOrigin);
  union.push(`  | "${slug}"`);
  if (cat !== lastCat) {
    entries.push(`  // ── ${sections[cat]} ──`);
    rust.push(`    // ── ${sections[cat]} ──`);
    lastCat = cat;
  }
  const lines = [];
  lines.push(`  ${slug.includes("-") ? `"${slug}"` : slug}: {`);
  lines.push(`    slug: "${slug}",`);
  lines.push(`    displayName: ${JSON.stringify(name)},`);
  for (const l of wrap(note, "    // ")) lines.push(l);
  lines.push(`    mcpServerUrl: ${JSON.stringify(d.url)},`);
  if (origins.length === 1) {
    lines.push(`    oauthAuthorizationServerOrigins: [${JSON.stringify(origins[0])}],`);
  } else {
    lines.push(`    oauthAuthorizationServerOrigins: [`);
    for (const o of origins) lines.push(`      ${JSON.stringify(o)},`);
    lines.push(`    ],`);
  }
  if (mode === "manual") lines.push(`    authMode: "manual",`);
  if (slug === "bigquery")
    lines.push(`    authorizeParams: { access_type: "offline", prompt: "consent" },`);
  lines.push(`  },`);
  entries.push(...lines);
  const olist = origins.map((o) => JSON.stringify(o)).join(", ");
  rust.push(`    (${JSON.stringify(mcpOrigin)}, &[${olist}]),`);
}

// Render: PAT, no OAuth origins.
union.push(`  | "render"`);
entries.push(
  `  // ── API token ──`,
  `  render: {`,
  `    slug: "render",`,
  `    displayName: "Render",`,
  `    // Hosted MCP authenticates with a Render API key as the Bearer (no DCR,`,
  `    // no OAuth-app product) — PAT mode like GitHub. Docs:`,
  `    // https://render.com/docs/mcp-server`,
  `    mcpServerUrl: "https://mcp.render.com/mcp",`,
  `    oauthAuthorizationServerOrigins: [],`,
  `    authMode: "pat",`,
  `    patHint:`,
  `      "Paste a Render API key (Dashboard → Account Settings → API Keys). It is broadly scoped to your workspaces, so prefer a dedicated account/key for agents.",`,
  `  },`,
);

writeFileSync("gen-union.txt", union.join("\n") + "\n");
writeFileSync("gen-entries.txt", entries.join("\n") + "\n");
writeFileSync("gen-rust.txt", rust.join("\n") + "\n");
// Docs name lists
const dcrNames = M.filter((m) => m[2] === "dcr").map((m) => m[1]);
const manualNames = M.filter((m) => m[2] === "manual").map((m) => m[1]);
writeFileSync("gen-docs-names.txt", `DCR (${dcrNames.length}): ${dcrNames.join(", ")}\n\nMANUAL (${manualNames.length}): ${manualNames.join(", ")}\n`);
console.log(`providers: ${M.length + 1} (dcr ${dcrNames.length}, manual ${manualNames.length}, pat 1)`);
