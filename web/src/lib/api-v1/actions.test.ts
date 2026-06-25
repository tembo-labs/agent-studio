import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiCtx } from "@/lib/api-v1/actions";

// Mock the data layer + audit so we exercise only the orchestration in
// createAutomationFor: validate → create → audit. createAutomation returns a
// row; getAgentByName resolves so the agent-exists pre-check passes.
vi.mock("@/lib/automations-api", () => ({
  createAutomation: vi.fn(),
}));
vi.mock("@/lib/workspace-agents", () => ({
  getAgentByName: vi.fn(),
  resolveAgentForDispatch: vi.fn(),
}));
vi.mock("@/lib/audit-db", () => ({ writeAuditEvent: vi.fn() }));

import {
  createAutomationFor,
  extractInboxLinks,
  sanitizeInboxLinks,
} from "@/lib/api-v1/actions";
import { createAutomation } from "@/lib/automations-api";
import { writeAuditEvent } from "@/lib/audit-db";
import { getAgentByName } from "@/lib/workspace-agents";

const mockCreate = vi.mocked(createAutomation);
const mockGetAgent = vi.mocked(getAgentByName);
const mockAudit = vi.mocked(writeAuditEvent);

function makeCtx(surface: "api" | "mcp" = "api"): ApiCtx {
  return {
    ok: true,
    workspace: {
      id: "ws-1",
      slug: "demo",
      name: "Demo",
      createdBy: "u-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      faviconKind: "default-tembo",
      commitMode: "pull_request",
    },
    userId: "u-1",
    role: "operator",
    apiKeyId: "key-1",
    surface,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetAgent.mockResolvedValue({ name: "reporter" } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockCreate.mockResolvedValue({ id: "auto-1" } as any);
});

describe("createAutomationFor", () => {
  it("writes one automation.created audit event attributed to the API-key user", async () => {
    const res = await createAutomationFor(makeCtx("api"), {
      name: "Daily report",
      agent: "reporter",
      cron: "0 9 * * *",
    });

    expect(res.ok).toBe(true);
    expect(mockAudit).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        actorUserId: "u-1",
        kind: "automation.created",
        targetType: "automation",
        targetId: "auto-1",
        agentName: "reporter",
        payload: expect.objectContaining({ via: "api", apiKeyId: "key-1" }),
      }),
    );
  });

  it("stamps the MCP surface as via:mcp", async () => {
    await createAutomationFor(makeCtx("mcp"), {
      name: "Daily report",
      agent: "reporter",
      cron: "0 9 * * *",
    });
    expect(mockAudit.mock.calls[0][0].payload).toMatchObject({ via: "mcp" });
  });

  it("does not audit when validation fails (no agent, no create)", async () => {
    const res = await createAutomationFor(makeCtx(), {
      name: "",
      agent: "reporter",
      cron: "0 9 * * *",
    });
    expect(res.ok).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });
});

describe("sanitizeInboxLinks", () => {
  it("keeps http(s) links and carries label + url through", () => {
    expect(
      sanitizeInboxLinks([
        { label: "ENG-1", url: "https://linear.app/a" },
        { url: "http://example.com/b" },
      ]),
    ).toEqual([
      { label: "ENG-1", url: "https://linear.app/a" },
      { url: "http://example.com/b" },
    ]);
  });

  it("drops non-http(s) schemes (javascript:, data:, mailto:) and malformed urls", () => {
    expect(
      sanitizeInboxLinks([
        { label: "xss", url: "javascript:alert(1)" },
        { url: "data:text/html,<script>1</script>" },
        { url: "mailto:a@b.com" },
        { url: "not a url" },
        { label: "ok", url: "https://ok.example/x" },
      ]),
    ).toEqual([{ label: "ok", url: "https://ok.example/x" }]);
  });

  it("trims, drops empty labels, and returns null when nothing survives", () => {
    expect(
      sanitizeInboxLinks([{ label: "  spaced  ", url: "  https://t.co/x  " }]),
    ).toEqual([{ label: "spaced", url: "https://t.co/x" }]);
    expect(sanitizeInboxLinks([])).toBeNull();
    expect(sanitizeInboxLinks(undefined)).toBeNull();
    expect(sanitizeInboxLinks([{ url: "ftp://nope" }])).toBeNull();
  });

  it("caps the list at 50 entries", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      url: `https://example.com/${i}`,
    }));
    expect(sanitizeInboxLinks(many)).toHaveLength(50);
  });

  it("de-dupes by url, keeping the first (labelled) occurrence", () => {
    expect(
      sanitizeInboxLinks([
        { label: "First", url: "https://x.com/a" },
        { url: "https://x.com/a" },
        { label: "Other", url: "https://x.com/b" },
      ]),
    ).toEqual([
      { label: "First", url: "https://x.com/a" },
      { label: "Other", url: "https://x.com/b" },
    ]);
  });
});

describe("extractInboxLinks", () => {
  const base = { itemType: "t", title: "t" };

  it("pulls Markdown links (with labels) and bare urls from the proposed text", () => {
    const links = extractInboxLinks({
      ...base,
      proposedAction: {
        text: "See [ENG-1](https://linear.app/a) and https://example.com/b.",
      },
    });
    expect(links).toContainEqual({ label: "ENG-1", url: "https://linear.app/a" });
    // Bare url with trailing sentence punctuation trimmed.
    expect(links).toContainEqual({ url: "https://example.com/b" });
  });

  it("pulls bare urls out of the context payload", () => {
    const links = extractInboxLinks({
      ...base,
      context: { stories: [{ url: "https://news.site/x" }] },
    });
    expect(links).toContainEqual({ url: "https://news.site/x" });
  });

  it("merges + de-dupes through sanitizeInboxLinks (Markdown label wins over a bare dupe)", () => {
    const input = {
      ...base,
      proposedAction: { text: "[ENG-1](https://linear.app/a)" },
      context: { ref: "https://linear.app/a" },
    };
    expect(sanitizeInboxLinks(extractInboxLinks(input))).toEqual([
      { label: "ENG-1", url: "https://linear.app/a" },
    ]);
  });
});
