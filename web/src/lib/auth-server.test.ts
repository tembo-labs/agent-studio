import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeWorkspace, DENIED_MESSAGE } from "./auth-server";

// US-0.4 exit-bar test: API-layer RBAC enforcement, not just the UI.
// `authorizeWorkspace` is the single funnel every server action +
// route handler uses; if the gating logic regresses here, denied
// users get through. We mock the three dependency boundaries
// (session, workspace lookup, role lookup) so the test isolates the
// policy decision from Next.js plumbing or Postgres.

// Subject-under-test is server-only and pulls these in at module
// evaluation time, so the mocks have to register before the
// authorizeWorkspace import is evaluated. vi.mock is hoisted to the
// top of the file by the runtime, so declaration order here doesn't
// actually matter — but we still place them up top to make the
// reading order match execution order.
vi.mock("@/lib/session", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/workspace", () => ({
  getWorkspaceBySlug: vi.fn(),
  getWorkspaceRole: vi.fn(),
}));

import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, getWorkspaceRole } from "@/lib/workspace";

const mockSession = vi.mocked(getServerSession);
const mockGetWs = vi.mocked(getWorkspaceBySlug);
const mockGetRole = vi.mocked(getWorkspaceRole);

const fakeWorkspace = {
  id: "ws-1",
  slug: "demo",
  name: "Demo",
  createdBy: "u-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  faviconKind: "neutral" as const,
};

function setSession(userId: string | null) {
  if (userId === null) {
    mockSession.mockResolvedValue(null);
  } else {
    // Cast through unknown — the real session shape has fields we
    // don't need to mock; we only read session.user.id.
    mockSession.mockResolvedValue({
      user: { id: userId },
    } as unknown as Awaited<ReturnType<typeof getServerSession>>);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetWs.mockResolvedValue(fakeWorkspace);
});

describe("authorizeWorkspace — deny tests (US-0.4-02 exit bar)", () => {
  it("operator is denied a workspace_admin-only action", async () => {
    setSession("u-op");
    mockGetRole.mockResolvedValue("operator");

    const result = await authorizeWorkspace("demo", "workspace_admin");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Discriminate the failure precisely — a "no-workspace" leak
      // would still fail .ok but for the wrong reason.
      expect(result.reason).toBe("denied");
      if (result.reason === "denied") {
        expect(result.actual).toBe("operator");
      }
    }
  });

  it("viewer is denied an operator-or-higher action", async () => {
    setSession("u-view");
    mockGetRole.mockResolvedValue("viewer");

    const result = await authorizeWorkspace("demo", "operator");

    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "denied") {
      expect(result.actual).toBe("viewer");
    }
  });

  it("non-member is denied any action", async () => {
    setSession("u-stranger");
    // A signed-in user who isn't a workspace_member yet — the DB
    // returns null role, which must not be treated as a member.
    mockGetRole.mockResolvedValue(null);

    const result = await authorizeWorkspace("demo", "viewer");

    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "denied") {
      expect(result.actual).toBe(null);
    }
  });

  it("no session → no-session (don't fall through to workspace lookup)", async () => {
    setSession(null);

    const result = await authorizeWorkspace("demo", "viewer");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no-session");
    // Critical: workspace lookup must not run for an anon caller —
    // otherwise we'd leak workspace existence via timing.
    expect(mockGetWs).not.toHaveBeenCalled();
  });

  it("unknown workspace → no-workspace (don't leak via role error)", async () => {
    setSession("u-1");
    mockGetWs.mockResolvedValue(null);

    const result = await authorizeWorkspace("demo", "viewer");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no-workspace");
    expect(mockGetRole).not.toHaveBeenCalled();
  });
});

describe("authorizeWorkspace — admit tests", () => {
  it("operator is admitted to an operator-level action", async () => {
    setSession("u-op");
    mockGetRole.mockResolvedValue("operator");

    const result = await authorizeWorkspace("demo", "operator");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe("operator");
      expect(result.userId).toBe("u-op");
      expect(result.workspace.slug).toBe("demo");
    }
  });

  it("workspace_admin is admitted to a workspace_admin action", async () => {
    setSession("u-admin");
    mockGetRole.mockResolvedValue("workspace_admin");

    const result = await authorizeWorkspace("demo", "workspace_admin");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.role).toBe("workspace_admin");
  });

  it("default minRole is viewer (omitted second arg)", async () => {
    setSession("u-view");
    mockGetRole.mockResolvedValue("viewer");

    const result = await authorizeWorkspace("demo");

    expect(result.ok).toBe(true);
  });
});

describe("DENIED_MESSAGE", () => {
  it("is the user-facing copy for the denied branch", () => {
    // Soft test — the message itself is editorial. We just want to
    // catch accidental empty strings or "TODO" placeholders that
    // would ship to users.
    expect(DENIED_MESSAGE).toMatch(/permission/);
    expect(DENIED_MESSAGE.length).toBeGreaterThan(20);
  });
});
