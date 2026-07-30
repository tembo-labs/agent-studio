import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the db boundary so the module loads and the query-shaped
// functions are callable without a real Postgres.
vi.mock("@/lib/db", () => ({
  db: { query: vi.fn() },
}));

import { db } from "@/lib/db";
import {
  addInstanceAdmin,
  isInstanceAdmin,
  listInstanceAdmins,
  removeInstanceAdmin,
} from "./instance-admins";

const mockQuery = vi.mocked(db.query);

const ORIGINAL_ENV = process.env.INSTANCE_ADMIN_EMAILS;

beforeEach(() => {
  mockQuery.mockReset();
  process.env.INSTANCE_ADMIN_EMAILS = "boot@acme.com, Second@acme.com";
});

afterEach(() => {
  process.env.INSTANCE_ADMIN_EMAILS = ORIGINAL_ENV;
});

function rows(r: unknown[], rowCount = r.length) {
  return { rows: r, rowCount } as never;
}

describe("isInstanceAdmin", () => {
  it("is false for missing emails without touching the db", async () => {
    expect(await isInstanceAdmin(null)).toBe(false);
    expect(await isInstanceAdmin(undefined)).toBe(false);
    expect(await isInstanceAdmin("")).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("honors the env allowlist (case-insensitive) without a db query", async () => {
    expect(await isInstanceAdmin("BOOT@acme.com")).toBe(true);
    expect(await isInstanceAdmin(" second@ACME.com ")).toBe(true);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("falls through to the instance_admin table", async () => {
    mockQuery.mockResolvedValueOnce(rows([{ 1: 1 }]));
    expect(await isInstanceAdmin("added@acme.com")).toBe(true);

    mockQuery.mockResolvedValueOnce(rows([]));
    expect(await isInstanceAdmin("stranger@acme.com")).toBe(false);
  });

  it("degrades to the env answer when the db errors (pre-migration window)", async () => {
    mockQuery.mockRejectedValueOnce(new Error("relation does not exist"));
    expect(await isInstanceAdmin("added@acme.com")).toBe(false);
    // env admins are unaffected by db errors
    expect(await isInstanceAdmin("boot@acme.com")).toBe(true);
  });
});

describe("addInstanceAdmin", () => {
  it("rejects malformed emails before touching the db", async () => {
    expect(await addInstanceAdmin("not-an-email", "u-1")).toEqual({
      ok: false,
      error: "bad-email",
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects env-listed emails as already admins", async () => {
    expect(await addInstanceAdmin("Boot@Acme.com", "u-1")).toEqual({
      ok: false,
      error: "already-admin",
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("inserts trimmed + lowercased and returns the stored email", async () => {
    mockQuery.mockResolvedValueOnce(rows([], 1));
    const res = await addInstanceAdmin("  New@Acme.com ", "u-1");
    expect(res).toEqual({ ok: true, email: "new@acme.com" });
    expect(mockQuery.mock.calls[0][1]).toEqual(["new@acme.com", "u-1"]);
  });

  it("treats an insert conflict as already-admin", async () => {
    mockQuery.mockResolvedValueOnce(rows([], 0));
    expect(await addInstanceAdmin("dupe@acme.com", "u-1")).toEqual({
      ok: false,
      error: "already-admin",
    });
  });
});

describe("removeInstanceAdmin", () => {
  it("reports whether a row was deleted", async () => {
    mockQuery.mockResolvedValueOnce(rows([], 1));
    expect(await removeInstanceAdmin("added@acme.com")).toBe(true);
    mockQuery.mockResolvedValueOnce(rows([], 0));
    expect(await removeInstanceAdmin("ghost@acme.com")).toBe(false);
  });
});

describe("listInstanceAdmins", () => {
  it("unions env and db admins, env first, deduped by email", async () => {
    mockQuery.mockResolvedValueOnce(
      rows([
        // also env-listed — must render once, as env
        { email: "boot@acme.com", added_by_name: "Ry", created_at: new Date() },
        { email: "added@acme.com", added_by_name: "Ry", created_at: new Date() },
      ]),
    );
    const admins = await listInstanceAdmins();
    expect(admins.map((a) => [a.email, a.source])).toEqual([
      ["boot@acme.com", "env"],
      ["second@acme.com", "env"],
      ["added@acme.com", "db"],
    ]);
    expect(admins[2].addedByName).toBe("Ry");
  });

  it("shows env admins only when the db errors", async () => {
    mockQuery.mockRejectedValueOnce(new Error("no db"));
    const admins = await listInstanceAdmins();
    expect(admins.map((a) => a.email)).toEqual([
      "boot@acme.com",
      "second@acme.com",
    ]);
  });
});
