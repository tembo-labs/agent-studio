import { describe, expect, it } from "vitest";

import { extractJson } from "./slack-router";

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"agent":"report","input":"do it"}')).toEqual({
      agent: "report",
      input: "do it",
    });
  });

  it("parses JSON wrapped in prose / code fences", () => {
    const text = 'Sure! Here you go:\n```json\n{"agent":"triage","input":"x"}\n```';
    expect(extractJson(text)).toEqual({ agent: "triage", input: "x" });
  });

  it("returns null when there is no object", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("")).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    expect(extractJson('{"agent": ,}')).toBeNull();
  });
});
