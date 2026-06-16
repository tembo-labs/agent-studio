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

import { createAutomationFor } from "@/lib/api-v1/actions";
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
