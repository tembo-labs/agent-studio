import { describe, expect, it } from "vitest";

import { diffLines } from "./text-diff";

describe("diffLines", () => {
  it("reports no change for identical text", () => {
    const d = diffLines("a\nb\nc", "a\nb\nc");
    expect(d.unchanged).toBe(true);
    expect(d.stats).toEqual({ added: 0, removed: 0 });
    expect(d.lines.every((l) => l.type === "context")).toBe(true);
  });

  it("detects an added line", () => {
    const d = diffLines("a\nc", "a\nb\nc");
    expect(d.stats).toEqual({ added: 1, removed: 0 });
    expect(d.lines).toContainEqual({ type: "add", text: "b" });
  });

  it("detects a removed line", () => {
    const d = diffLines("a\nb\nc", "a\nc");
    expect(d.stats).toEqual({ added: 0, removed: 1 });
    expect(d.lines).toContainEqual({ type: "remove", text: "b" });
  });

  it("treats a changed line as remove + add", () => {
    const d = diffLines("model: gpt-4o-mini", "model: claude-sonnet-5");
    expect(d.stats).toEqual({ added: 1, removed: 1 });
    expect(d.unchanged).toBe(false);
  });

  it("handles empty inputs", () => {
    expect(diffLines("", "").unchanged).toBe(true);
    expect(diffLines("", "a\nb").stats).toEqual({ added: 2, removed: 0 });
    expect(diffLines("a\nb", "").stats).toEqual({ added: 0, removed: 2 });
  });
});
