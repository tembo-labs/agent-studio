import { describe, expect, it } from "vitest";

import {
  categoryStatus,
  collectConnectedSlugs,
  rankLibrary,
  type Rankable,
} from "./connection-categories";

describe("collectConnectedSlugs", () => {
  it("merges + lowercases slugs across substrates", () => {
    const set = collectConnectedSlugs(
      [{ toolkit: "Slack" }, { toolkit: "googlecalendar" }],
      [{ type: "Attio" }],
      [{ slug: "STRIPE" }],
    );
    expect(set).toEqual(new Set(["slack", "googlecalendar", "attio", "stripe"]));
  });
});

describe("categoryStatus", () => {
  const connected = new Set(["attio", "slack"]);

  it("satisfied when the user has a matching slug", () => {
    expect(categoryStatus("crm", connected).satisfied).toBe(true); // attio ∈ crm
    expect(categoryStatus("notify", connected).satisfied).toBe(true); // slack
  });

  it("unsatisfied when no matching slug", () => {
    expect(categoryStatus("recorder", connected).satisfied).toBe(false);
  });

  it("built-in categories are always satisfied", () => {
    const empty = new Set<string>();
    expect(categoryStatus("web", empty)).toMatchObject({ satisfied: true, builtin: true });
    expect(categoryStatus("tasks-inbox", empty).satisfied).toBe(true);
  });

  it("unsupported categories are never satisfied (Not yet connectable)", () => {
    const s = categoryStatus("ims", new Set(["ims"]));
    expect(s.supported).toBe(false);
    expect(s.satisfied).toBe(false);
  });

  // The knowledge-work-plugins connector batch: each new native provider slug
  // must satisfy its category.
  it.each([
    ["notion", "docs"],
    ["guru", "docs"],
    ["intercom", "helpdesk"],
    ["atlassian", "issues"],
    ["asana", "issues"],
    ["monday", "issues"],
    ["fireflies", "recorder"],
    ["amplitude", "analytics"],
    ["apollo", "enrichment"],
  ] as const)("%s satisfies the %s category", (slug, category) => {
    expect(categoryStatus(category, new Set([slug])).satisfied).toBe(true);
  });
});

describe("rankLibrary", () => {
  const agents: (Rankable & { id: string })[] = [
    { id: "crm-slack", categories: ["crm", "notify"], firstWave: false, score: 2 },
    { id: "recorder-only", categories: ["recorder"], firstWave: true, score: 1 },
    { id: "builtin-only", categories: ["web", "tasks-inbox"], firstWave: false, score: 0 },
    { id: "ims-only", categories: ["ims"], firstWave: false, score: 3 },
  ];

  it("marks a starter ready only when all non-built-in categories are satisfied", () => {
    const connected = new Set(["attio", "slack"]);
    const ranked = rankLibrary(agents, connected);
    const byId = Object.fromEntries(ranked.map((r) => [r.agent.id, r]));
    expect(byId["crm-slack"].ready).toBe(true);
    expect(byId["builtin-only"].ready).toBe(true); // built-ins never block
    expect(byId["recorder-only"].ready).toBe(false); // no recorder connected
    expect(byId["ims-only"].ready).toBe(false); // unsupported category
  });

  it("sorts ready-first, then First Wave, then score", () => {
    const connected = new Set(["attio", "slack"]);
    const order = rankLibrary(agents, connected).map((r) => r.agent.id);
    // ready group first: crm-slack (score 2) + builtin-only (score 0) → crm-slack leads;
    // then unready: recorder-only (firstWave) before ims-only (score 3 but not firstWave).
    expect(order).toEqual(["crm-slack", "builtin-only", "recorder-only", "ims-only"]);
  });

  it("with no connections, only built-in/connection-free starters are ready", () => {
    const ranked = rankLibrary(agents, new Set<string>());
    const ready = ranked.filter((r) => r.ready).map((r) => r.agent.id);
    expect(ready).toEqual(["builtin-only"]);
  });
});
