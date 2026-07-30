import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  decryptSecret: vi.fn(),
  getWorkspaceSecretPlaintext: vi.fn(),
  getWorkspaceSecretPreview: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { query: mocks.query } }));
vi.mock("@/lib/crypto", () => ({
  decryptSecret: mocks.decryptSecret,
  encryptSecret: vi.fn(),
  last4: vi.fn(),
}));
vi.mock("@/lib/workspace", () => ({
  getWorkspaceSecretPlaintext: mocks.getWorkspaceSecretPlaintext,
  getWorkspaceSecretPreview: mocks.getWorkspaceSecretPreview,
}));

import {
  isTemboConfiguredForUser,
  resolveTemboCredential,
} from "./tembo-credentials";

describe("resolveTemboCredential", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers the acting member's personal Tembo key", async () => {
    mocks.query.mockResolvedValue({ rows: [{ ciphertext: Buffer.from("key") }] });
    mocks.decryptSecret.mockReturnValue("personal-key");

    await expect(resolveTemboCredential("workspace-1", "user-2")).resolves.toEqual({
      apiKey: "personal-key",
      source: "personal",
    });
    expect(mocks.getWorkspaceSecretPreview).not.toHaveBeenCalled();
  });

  it("falls back to the workspace Tembo key", async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    mocks.getWorkspaceSecretPreview.mockResolvedValue({
      last4: "1234",
      updatedAt: new Date(),
    });
    mocks.getWorkspaceSecretPlaintext.mockResolvedValue("workspace-key");

    await expect(resolveTemboCredential("workspace-1", "user-2")).resolves.toEqual({
      apiKey: "workspace-key",
      source: "workspace_fallback",
    });
  });

  it("returns null when neither credential exists", async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    mocks.getWorkspaceSecretPreview.mockResolvedValue(null);

    await expect(resolveTemboCredential("workspace-1", "user-2")).resolves.toBeNull();
  });
});

describe("isTemboConfiguredForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recognizes a validated personal credential without a workspace key", async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          last4: "abcd",
          updated_at: new Date("2026-07-30T00:00:00Z"),
          metadata: { temboUserId: "tembo-user", temboOrgId: "tembo-org" },
        },
      ],
    });

    await expect(
      isTemboConfiguredForUser("workspace-1", "user-2"),
    ).resolves.toBe(true);
    expect(mocks.getWorkspaceSecretPreview).not.toHaveBeenCalled();
  });
});
