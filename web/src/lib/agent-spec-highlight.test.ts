import { describe, expect, it } from "vitest";

import {
  detectAgentSpecLanguage,
  highlightAgentSpec,
  type AgentSpecHighlightKind,
} from "./agent-spec-highlight";

function byKind(source: string, language: "json" | "yaml") {
  return highlightAgentSpec(source, language).reduce(
    (acc, token) => {
      (acc[token.kind] ??= []).push(token.text);
      return acc;
    },
    {} as Partial<Record<AgentSpecHighlightKind, string[]>>,
  );
}

describe("detectAgentSpecLanguage", () => {
  it("treats cargo-ai specs as JSON", () => {
    expect(detectAgentSpecLanguage("name: hello\n", "cargo-ai")).toBe("json");
  });

  it("recognizes JSON pydantic specs from their first non-space character", () => {
    expect(
      detectAgentSpecLanguage('  {"name":"hello"}', "pydantic-agentspec"),
    ).toBe("json");
  });
});

describe("highlightAgentSpec", () => {
  it("highlights JSON object keys separately from values", () => {
    const tokens = byKind(
      '{\n  "name": "hello",\n  "parallel": true,\n  "retries": 2\n}\n',
      "json",
    );

    expect(tokens.key).toEqual(['"name"', '"parallel"', '"retries"']);
    expect(tokens.string).toEqual(['"hello"']);
    expect(tokens.literal).toEqual(["true"]);
    expect(tokens.number).toEqual(["2"]);
  });

  it("highlights YAML keys, scalar values, numbers, literals, and comments", () => {
    const tokens = byKind(
      [
        "# Sample",
        "name: hello-world",
        "parallel: true",
        "retries: 2",
        "model: anthropic:claude-sonnet-5 # default",
        "",
      ].join("\n"),
      "yaml",
    );

    expect(tokens.comment).toEqual(["# Sample", "# default"]);
    expect(tokens.key).toEqual(["name", "parallel", "retries", "model"]);
    expect(tokens.literal).toEqual(["true"]);
    expect(tokens.number).toEqual(["2"]);
    expect(tokens.string).toEqual([
      "hello-world",
      "anthropic:claude-sonnet-5",
    ]);
  });

  it("highlights quoted YAML keys without regex backtracking", () => {
    const escaped = "\\!".repeat(2000);
    const tokens = byKind(
      [
        `"display name": "LinkedIn inbox"`,
        `'owner''s key': support`,
        `"${escaped}": value`,
        "",
      ].join("\n"),
      "yaml",
    );

    expect(tokens.key).toEqual([
      '"display name"',
      "'owner''s key'",
      `"${escaped}"`,
    ]);
    expect(tokens.string).toEqual(['"LinkedIn inbox"', "support", "value"]);
  });

  it("does not parse block scalar body lines as YAML keys", () => {
    const tokens = byKind(
      [
        "instructions: |",
        "  Subject: keep this as instruction text",
        "  Count: 3",
        "model: anthropic:claude-sonnet-5",
        "",
      ].join("\n"),
      "yaml",
    );

    expect(tokens.key).toEqual(["instructions", "model"]);
    expect(tokens.plain?.join("")).toContain(
      "  Subject: keep this as instruction text",
    );
    expect(tokens.plain?.join("")).toContain("  Count: 3");
  });
});
