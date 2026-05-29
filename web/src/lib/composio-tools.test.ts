import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { usePolly } from "@/test/polly";

import { fetchComposioToolkitTools } from "./composio-tools";

// Pilot Polly test — proves the cassette flow works end-to-end
// against the kind of API we actually call (Composio's /api/v3/tools
// REST endpoint, a fetch-based JSON GET). Uses a hand-crafted
// cassette so the suite can run on a fresh clone with no
// Composio key. Re-record with POLLY_RECORD=1 if Composio's
// response shape changes.

describe("fetchComposioToolkitTools (Polly cassette)", () => {
  let polly: ReturnType<typeof usePolly>;

  beforeEach(() => {
    polly = usePolly("composio-tools-slack");
    // Intercept the Composio endpoint and serve a canned response.
    // We use Polly's server API rather than a recorded cassette
    // here so the test is self-contained and doesn't depend on a
    // committed binary asset. A real "list-of-tools" test would
    // recordIfMissing the first time and then replay.
    polly.server
      .get("https://backend.composio.dev/api/v3/tools")
      .intercept((req, res) => {
        // Sanity-check the query params the caller built — guards
        // against accidental shape drift in fetchComposioToolkitTools.
        expect(req.query.toolkit_slug).toBe("slack");
        expect(req.query.limit).toBe("500");
        res.status(200).json({
          items: [
            {
              slug: "SLACK_SEND_MESSAGE",
              name: "Send Message",
              description: "Send a message to a Slack channel.",
            },
            {
              slug: "SLACK_LIST_CHANNELS",
              name: "List Channels",
              description: "List the channels in a Slack workspace.",
            },
          ],
          next_cursor: null,
        });
      });
  });

  afterEach(async () => {
    await polly.stop();
  });

  it("returns a normalized FetchedComposioTool[] for the toolkit", async () => {
    const tools = await fetchComposioToolkitTools("ak_fake_for_test", "slack");

    expect(tools).toEqual([
      {
        slug: "SLACK_SEND_MESSAGE",
        name: "Send Message",
        description: "Send a message to a Slack channel.",
      },
      {
        slug: "SLACK_LIST_CHANNELS",
        name: "List Channels",
        description: "List the channels in a Slack workspace.",
      },
    ]);
  });

  it("throws with a useful message on non-2xx (operator triage signal)", async () => {
    // Replace the success intercept with an error so the test can
    // assert the error path is informative — when Composio's key
    // rotates underneath a customer, the operator needs the status
    // code + body in their run log.
    polly.server.get("https://backend.composio.dev/api/v3/tools").intercept(
      (_req, res) => {
        res.status(401).json({ error: "Invalid API key" });
      },
    );

    await expect(
      fetchComposioToolkitTools("ak_bad", "slack"),
    ).rejects.toThrow(/401/);
  });
});
