import { beforeAll, describe, expect, it, vi } from "vitest";

// Mock the db boundary so the module loads and the query-shaped functions are
// callable without a real Postgres. The pure crypto/token helpers
// (generateApiKey, sha256Hex, apiKeyTokenMatches) don't touch it.
vi.mock("@/lib/db", () => ({
  db: { query: vi.fn() },
}));

import {
  apiKeyTokenMatches,
  generateApiKey,
  getApiKeyByToken,
  sha256Hex,
  type ApiKeyRow,
} from "./api-keys-db";
import { encryptSecret } from "./crypto";
import { db } from "@/lib/db";

const mockQuery = vi.mocked(db.query);

beforeAll(() => {
  // 32 zero bytes, base64 — satisfies crypto.ts's KEY_LEN check for the
  // encrypt/decrypt round-trip exercised by apiKeyTokenMatches.
  process.env.TAS_ENCRYPTION_KEY = Buffer.alloc(32).toString("base64");
});

function fakeRow(token: string): ApiKeyRow {
  return {
    id: "key-1",
    workspaceId: "ws-1",
    userId: "u-1",
    name: "test",
    tokenLast4: token.slice(-4),
    enabled: true,
    lastUsedAt: null,
    createdBy: "u-1",
    createdAt: new Date(),
    tokenCiphertext: encryptSecret(token),
  };
}

describe("generateApiKey", () => {
  it("has the tas_ prefix and is high-entropy", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.startsWith("tas_")).toBe(true);
    expect(a.length).toBeGreaterThan(40);
    expect(a).not.toBe(b); // randomness
  });
});

describe("sha256Hex", () => {
  it("is deterministic and 64 hex chars", () => {
    const h = sha256Hex("tas_abc");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex("tas_abc")).toBe(h);
    expect(sha256Hex("tas_abd")).not.toBe(h);
  });
});

describe("apiKeyTokenMatches", () => {
  it("matches the exact token that was encrypted", () => {
    const token = generateApiKey();
    expect(apiKeyTokenMatches(fakeRow(token), token)).toBe(true);
  });

  it("rejects a different token of equal length", () => {
    const token = generateApiKey();
    const other = generateApiKey(); // same length, different value
    expect(apiKeyTokenMatches(fakeRow(token), other)).toBe(false);
  });

  it("rejects a length-mismatched token without throwing", () => {
    const token = generateApiKey();
    expect(apiKeyTokenMatches(fakeRow(token), "tas_short")).toBe(false);
  });

  it("rejects when the ciphertext is corrupt", () => {
    const row = { ...fakeRow(generateApiKey()), tokenCiphertext: Buffer.from([1, 2, 3]) };
    expect(apiKeyTokenMatches(row, "tas_whatever")).toBe(false);
  });
});

describe("getApiKeyByToken", () => {
  it("looks up by the keyless sha256 hash, never the raw token", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    await getApiKeyByToken("tas_lookup");
    const [, params] = mockQuery.mock.calls[0];
    expect(params).toEqual([sha256Hex("tas_lookup")]);
  });

  it("returns null for an unknown token", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    expect(await getApiKeyByToken("tas_nope")).toBeNull();
  });
});
