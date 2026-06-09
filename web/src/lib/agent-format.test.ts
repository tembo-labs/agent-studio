import { describe, expect, it } from "vitest";

import { parseAgentContent } from "@/lib/agent-format";

// Minimal valid Pydantic spec + an extra line under test.
function pyd(extra: string): string {
  return `name: test-agent\nmodel: anthropic:claude-sonnet-4-6\ninstructions: do it\n${extra}`;
}

function skillsOf(content: string): string[] | null {
  const r = parseAgentContent(content, "yaml");
  if (r.ok && r.spec.framework === "pydantic-agentspec") return r.spec.skills;
  return null;
}

describe("agentspec `skills:` parsing", () => {
  it("parses a string array", () => {
    expect(skillsOf(pyd("skills: [pdf, my-skill]"))).toEqual(["pdf", "my-skill"]);
  });

  it("accepts a comma string, lowercases + dedupes", () => {
    expect(skillsOf(pyd('skills: "PDF, pdf, My-Skill"'))).toEqual([
      "pdf",
      "my-skill",
    ]);
  });

  it("drops path-y and empty entries", () => {
    expect(skillsOf(pyd("skills: ['../etc', '', good, a/b]"))).toEqual(["good"]);
  });

  it("defaults to [] when absent", () => {
    expect(skillsOf(pyd(""))).toEqual([]);
  });
});
