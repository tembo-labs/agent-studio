import { describe, expect, it } from "vitest";

import {
  renderIndexMarkdown,
  renderProviderMarkdown,
  type ForAgentsTool,
} from "@/lib/for-agents-markdown";
import type { McpProvider } from "@/lib/mcp-providers";

// Only the fields renderProviderMarkdown reads; cast covers the rest.
const provider = {
  slug: "tembo-agent-studio",
  displayName: "Tembo Agent Studio",
  mcpServerUrl: "",
} as McpProvider;

describe("renderProviderMarkdown — parameter tables", () => {
  it("renders a Parameters section with name/type/required/description from inputSchema", () => {
    const tools: ForAgentsTool[] = [
      {
        slug: "produce_inbox_item",
        name: "produce_inbox_item",
        description: "Add an item to the inbox.",
        inputSchema: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string", description: "Short label." },
            links: {
              type: "array",
              description: "Deep links.",
              items: { type: "object" },
            },
            priority: {
              enum: ["low", "high"],
              description: "How urgent.",
            },
          },
        },
      },
    ];

    const md = renderProviderMarkdown(provider, tools);
    expect(md).toContain("## Parameters");
    expect(md).toContain("### `produce_inbox_item`");
    expect(md).toContain("| `title` | string | yes | Short label. |");
    expect(md).toContain("| `links` | array<object> | no | Deep links. |");
    // The `|` inside the enum is escaped so it can't break the markdown table.
    expect(md).toContain("| `priority` | enum(low \\| high) | no | How urgent. |");
  });

  it("omits the Parameters section for tools without a schema or properties", () => {
    const tools: ForAgentsTool[] = [
      { slug: "a", name: "a", description: "no schema", inputSchema: null },
      {
        slug: "b",
        name: "b",
        description: "empty props",
        inputSchema: { type: "object", properties: {} },
      },
    ];
    const md = renderProviderMarkdown(provider, tools);
    expect(md).not.toContain("## Parameters");
  });
});

describe("renderIndexMarkdown — Agent Skills section", () => {
  const base = "https://tas.example/for-agents";
  const providers = [provider];

  it("lists installed skills with descriptions", () => {
    const md = renderIndexMarkdown(base, providers, new Set(), [
      { name: "pdf", description: "Read + fill PDFs." },
      { name: "brand", description: null },
    ]);
    expect(md).toContain("## Agent Skills");
    expect(md).toContain("`skills: [pdf]`");
    expect(md).toContain("- `pdf` — Read + fill PDFs.");
    expect(md).toContain("- `brand`");
  });

  it("notes when none are installed, and hints at the token in the public view", () => {
    expect(renderIndexMarkdown(base, providers, new Set(), [])).toContain(
      "No skills installed here yet._",
    );
    // tokenless (skills omitted): suggest sending a token
    expect(renderIndexMarkdown(base, providers, new Set())).toContain(
      "send a token to list this workspace's skills",
    );
  });
});
