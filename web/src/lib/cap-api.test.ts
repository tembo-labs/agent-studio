import { afterEach, describe, expect, it, vi } from "vitest";

import { validateTemboApiKey } from "./cap-api";

describe("validateTemboApiKey", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the Tembo account identity for a valid key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ userId: "user-1", orgId: "org-1" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(validateTemboApiKey("secret-key")).resolves.toEqual({
      ok: true,
      userId: "user-1",
      orgId: "org-1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.tembo.io/public-api/me",
      expect.objectContaining({
        headers: { Authorization: "Bearer secret-key" },
      }),
    );
  });

  it("rejects a response without an authenticated identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ userId: null, orgId: null }), {
          status: 200,
        }),
      ),
    );

    await expect(validateTemboApiKey("bad-key")).resolves.toEqual({
      ok: false,
      error: "invalid",
    });
  });
});
