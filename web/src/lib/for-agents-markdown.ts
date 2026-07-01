import type { McpProvider } from "@/lib/mcp-providers";

// Markdown for the agent-facing native-MCP tool reference (the /for-agents
// routes). Served as text/markdown so CAP can read it cheaply when authoring a
// `tools:` list for a `source: native-mcp` connection.

export type ForAgentsTool = {
  slug: string;
  name: string | null;
  description: string | null;
  /** The tool's input JSON Schema (MCP `tool.inputSchema`), rendered as a
   *  per-tool parameter table so authors see the exact fields. Null/absent for
   *  tools cached before schemas were captured (re-sync to populate). */
  inputSchema?: Record<string, unknown> | null;
};

// A minimal JSON-Schema property node — only the bits we render.
type SchemaNode = {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  items?: SchemaNode;
  anyOf?: SchemaNode[];
  oneOf?: SchemaNode[];
};

// A one-line, human-readable type label for a JSON-Schema property node.
// Defensive: any unknown shape falls back to "any".
function schemaType(node: SchemaNode | undefined): string {
  if (!node || typeof node !== "object") return "any";
  if (Array.isArray(node.enum) && node.enum.length > 0) {
    return `enum(${node.enum.map((v) => String(v)).join(" | ")})`;
  }
  const variants = node.anyOf ?? node.oneOf;
  if (Array.isArray(variants) && variants.length > 0) {
    return variants.map(schemaType).join(" | ");
  }
  const t = Array.isArray(node.type) ? node.type.join(" | ") : node.type;
  if (t === "array") return `array<${schemaType(node.items)}>`;
  return t ?? "object";
}

// Render a tool's input JSON Schema as a `| param | type | required | description |`
// table. Returns "" when the schema declares no properties.
function renderParams(schema: Record<string, unknown> | null | undefined): string {
  if (!schema || typeof schema !== "object") return "";
  const props = schema.properties;
  if (!props || typeof props !== "object") return "";
  const required = new Set(
    Array.isArray(schema.required) ? (schema.required as string[]) : [],
  );
  const entries = Object.entries(props as Record<string, SchemaNode>);
  if (entries.length === 0) return "";
  const lines = ["| param | type | required | description |", "| --- | --- | --- | --- |"];
  for (const [name, node] of entries) {
    lines.push(
      `| \`${cell(name)}\` | ${cell(schemaType(node))} | ${required.has(name) ? "yes" : "no"} | ${cell(node?.description ?? null)} |`,
    );
  }
  return lines.join("\n");
}

// Escape a cell for a GitHub-flavored markdown table (backslashes + pipes +
// newlines). Backslashes are escaped first so an input backslash can't combine
// with the pipe-escaping we add (or escape the trailing cell boundary).
function cell(s: string | null): string {
  return (s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n+/g, " ")
    .trim();
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

    // Per-tool parameter tables, for the tools whose schema declared fields.
    // Lets an author see the exact arguments (names, types, required) instead
    // of guessing from the description.
    const withParams = tools
      .map((t) => ({ tool: t, params: renderParams(t.inputSchema) }))
      .filter((x) => x.params !== "");
    if (withParams.length > 0) {
      lines.push("## Parameters", "");
      for (const { tool, params } of withParams) {
        lines.push(`### \`${tool.slug}\``, "", params, "");
      }
    }
  }
  return lines.join("\n");
}

/** The /for-agents index: links to each provider's page. Every page (and this
 *  index) requires an `Authorization: Bearer <token>` header. `connected` is
 *  the set of provider slugs that have cached tools. */
export function renderIndexMarkdown(
  baseUrl: string,
  providers: McpProvider[],
  connected: Set<string>,
  /** Installed Agent Skills for this workspace (token-gated). Omitted/empty in
   *  the public/tokenless view, which still documents the field + sources. */
  skills?: { name: string; description: string | null }[],
): string {
  const lines = [
    "# Native MCP tool reference (for agents)",
    "",
    "One page per provider, listing the exact tool slugs to put in an agent's",
    "`tools:` list when it declares a `source: native-mcp` connection. Each page",
    "requires the same `Authorization: Bearer <token>` header used to fetch this",
    "index.",
    "",
  ];
  for (const p of [...providers].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  )) {
    const note = connected.has(p.slug) ? "" : " — _not connected here yet_";
    lines.push(`- [${p.displayName}](${baseUrl}/${p.slug}.md) — \`${p.slug}\`${note}`);
  }
  lines.push("");

  // Agent Skills — reusable SKILL.md capabilities an agent opts into with its
  // `skills:` field. Only skills already installed under skills/<name>/ can be
  // referenced (a missing one fails the run), so list what's installed here.
  lines.push(
    "## Agent Skills",
    "",
    "Reusable `SKILL.md` capabilities an agent opts into with its `skills:` field",
    "(e.g. `skills: [pdf]`). They live in `skills/<name>/` in this repo — only",
    "reference ones already installed (a missing skill fails the run). Operators",
    "install more from the Skills page: **Anthropic's knowledge-work library**,",
    "skills.sh, a custom `.zip` upload, or the Claude API.",
    "",
  );
  if (skills && skills.length > 0) {
    lines.push("Installed here:", "");
    for (const s of [...skills].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`- \`${s.name}\`${s.description ? ` — ${s.description}` : ""}`);
    }
    lines.push("");
  } else {
    lines.push(
      "_No skills installed here yet" +
        (skills ? "" : " (send a token to list this workspace's skills)") +
        "._",
      "",
    );
  }
  return lines.join("\n");
}
