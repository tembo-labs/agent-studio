import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchTemboTask } from "@/lib/cap-api";

const input = {
  prompt: "Update the agent instructions",
  repositoryUrl: "https://github.com/tembo/example",
  targetBranch: "main",
};

describe("dispatchTemboTask", () => {
  beforeEach(() => {
    vi.stubEnv("TEMBO_API_URL", "https://api.example.test");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
      "https://api.example.test/session/existing-session/message",
    );
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
      "https://api.example.test/session/missing-session/message",
      "https://api.example.test/public-api/session/create",
    ]);
  });
});
