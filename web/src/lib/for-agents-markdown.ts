import type { McpProvider } from "@/lib/mcp-providers";

// Markdown for the agent-facing native-MCP tool reference (the /for-agents
// routes). Served as text/markdown so CAP can read it cheaply when authoring a
// `tools:` list for a `source: native-mcp` connection.

export type ForAgentsTool = {
  slug: string;
  name: string | null;
  description: string | null;
};

// Escape a cell for a GitHub-flavored markdown table (pipes + newlines).
function cell(s: string | null): string {
  return (s ?? "").replace(/\|/g, "\\|").replace(/\r?\n+/g, " ").trim();
}

/** One provider's tool reference. `tools` is the workspace's cached catalog
 *  for that provider (deduped by slug); empty when nothing is cached yet. */
export function renderProviderMarkdown(
  provider: McpProvider,
  tools: ForAgentsTool[],
): string {
  const server = provider.mcpServerUrl
    ? `MCP server: \`${provider.mcpServerUrl}\``
    : "MCP server: this TAS instance's own `/mcp` endpoint.";
  const lines = [
    `# ${provider.displayName} — native MCP tools`,
    "",
    server,
    "",
    "Declare this connection in the agent spec with `source: native-mcp` and",
    "the authorized slot name, then narrow `tools:` to the slugs you need:",
    "",
    "```yaml",
    "connections:",
    `  - ${provider.slug}:`,
    "      source: native-mcp",
    "      name: <your-authorized-slot-name>",
    `      tools: [${tools.length ? tools[0].slug : "<a-slug-below>"}]`,
    "```",
    "",
    "## Tools",
    "",
  ];
  if (tools.length === 0) {
    lines.push(
      "_No tools cached for this connection yet._ Open Connections → Native",
      "MCP in TAS and click Refresh, then reload this page.",
      "",
    );
  } else {
    lines.push("| slug | name | description |", "| --- | --- | --- |");
    for (const t of tools) {
      lines.push(`| \`${cell(t.slug)}\` | ${cell(t.name)} | ${cell(t.description)} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** The /for-agents index: links to each provider's page (carrying the key).
 *  `connected` is the set of provider slugs that have cached tools. */
export function renderIndexMarkdown(
  baseUrl: string,
  key: string,
  providers: McpProvider[],
  connected: Set<string>,
): string {
  const q = `?key=${encodeURIComponent(key)}`;
  const lines = [
    "# Native MCP tool reference (for agents)",
    "",
    "One page per provider, listing the exact tool slugs to put in an agent's",
    "`tools:` list when it declares a `source: native-mcp` connection.",
    "",
  ];
  for (const p of [...providers].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  )) {
    const note = connected.has(p.slug) ? "" : " — _not connected here yet_";
    lines.push(`- [${p.displayName}](${baseUrl}/${p.slug}.md${q}) — \`${p.slug}\`${note}`);
  }
  lines.push("");
  return lines.join("\n");
}
