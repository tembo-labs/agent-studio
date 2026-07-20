import { describe, expect, it } from "vitest";

import { looksLikeMarkdown } from "./context-view";

describe("looksLikeMarkdown", () => {
  it("detects common markdown constructs", () => {
    expect(looksLikeMarkdown("# Digest\nbody")).toBe(true);
    expect(looksLikeMarkdown("**TOP 3 TO ACT ON**")).toBe(true);
    expect(looksLikeMarkdown("intro\n- first\n- second")).toBe(true);
    expect(looksLikeMarkdown("1. first\n2. second")).toBe(true);
    expect(looksLikeMarkdown("see [the source](https://example.com)")).toBe(
      true,
    );
    expect(looksLikeMarkdown("```\ncode\n```")).toBe(true);
    expect(looksLikeMarkdown("> quoted")).toBe(true);
  });

  it("leaves plain text alone", () => {
    expect(looksLikeMarkdown("Deal moved to Evaluation")).toBe(false);
    // Multiline plain text with meaningful line breaks must stay pre-wrap —
    // markdown rendering would collapse the single newlines.
    expect(looksLikeMarkdown("line one\nline two\nline three")).toBe(false);
    // Bare URLs render via the existing link branch, not markdown.
    expect(looksLikeMarkdown("https://example.com/thing")).toBe(false);
    // Asterisks/underscores mid-word (identifiers, emphasis-less text).
    expect(looksLikeMarkdown("snake_case and 2*3=6")).toBe(false);
  });
});
