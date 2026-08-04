import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchTemboTask, validateTemboApiKey } from "@/lib/cap-api";

const input = {
  prompt: "Update the agent instructions",
  repositoryUrl: "https://github.com/tembo/example",
  targetBranch: "main",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("dispatchTemboTask", () => {
  beforeEach(() => {
    vi.stubEnv("TEMBO_API_URL", "https://api.example.test");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("creates a new session when there is no prior agent task", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: "new-session",
        title: "Update agent",
        status: "queued",
        htmlUrl: "https://app.tembo.io/sessions/new-session",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchTemboTask({ apiKey: "secret", input });

    expect(result).toEqual({
      ok: true,
      result: {
        taskId: "new-session",
        title: "Update agent",
        status: "queued",
        htmlUrl: "https://app.tembo.io/sessions/new-session",
      },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/public-api/session/create",
    );
  });

  it("submits a follow-up to the existing agent session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        message: { isQueued: true },
        session: { id: "existing-session", title: "Update agent" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchTemboTask({
      apiKey: "secret",
      input,
      existingTask: {
        taskId: "existing-session",
        htmlUrl: "https://app.tembo.io/sessions/existing-session",
      },
    });

    expect(result).toEqual({
      ok: true,
      result: {
        taskId: "existing-session",
        title: "Update agent",
        status: "queued",
        htmlUrl: "https://app.tembo.io/sessions/existing-session",
      },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/session/existing-session/messages",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer secret",
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      content: input.prompt,
    });
  });

  it("creates a new session when the prior Tembo session no longer exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockResolvedValueOnce(
        Response.json({
          id: "replacement-session",
          title: "Update agent",
          status: "queued",
          htmlUrl: "https://app.tembo.io/sessions/replacement-session",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchTemboTask({
      apiKey: "secret",
      input,
      existingTask: {
        taskId: "missing-session",
        htmlUrl: "https://app.tembo.io/sessions/missing-session",
      },
    });

    expect(result.ok && result.result.taskId).toBe("replacement-session");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.test/session/missing-session/messages",
      "https://api.example.test/public-api/session/create",
    ]);
  });
});

describe("validateTemboApiKey", () => {
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
