import { describe, expect, it } from "vitest";

import { parseCommand } from "./slack-dispatch";

describe("parseCommand", () => {
  it("splits the first token as the agent, rest as input", () => {
    expect(parseCommand("report generate the weekly summary")).toEqual({
      agentName: "report",
      input: "generate the weekly summary",
    });
  });

  it("handles an agent with no input", () => {
    expect(parseCommand("report")).toEqual({ agentName: "report", input: "" });
    expect(parseCommand("report   ")).toEqual({
      agentName: "report",
      input: "",
    });
  });

  it("returns an empty agent for blank text", () => {
    expect(parseCommand("")).toEqual({ agentName: "", input: "" });
    expect(parseCommand("   ")).toEqual({ agentName: "", input: "" });
  });

  it("preserves multi-line input", () => {
    expect(parseCommand("triage line one\nline two")).toEqual({
      agentName: "triage",
      input: "line one\nline two",
    });
  });

  it("trims leading whitespace before the agent", () => {
    expect(parseCommand("   support help")).toEqual({
      agentName: "support",
      input: "help",
    });
  });
});
