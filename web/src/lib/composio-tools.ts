import "server-only";

// Fetch the catalog of tools Composio exposes for a given toolkit.
// We hit /api/v3/tools directly rather than going through the
// @composio/core SDK because that endpoint's curated-subset
// behaviour is exactly what the Connections UI wants: ~11 named
// tools per toolkit instead of the 100+ raw set most providers
// publish (Slack alone has 100+ actions). The curated subset is
// also stable across users — it depends only on the toolkit, not
// on the connected account — so we can cache it per-connection
// without re-querying for every member.
//
// The script at web/scripts/composio-tools.mjs does the same thing
// from the CLI; this is the runtime version called from the
// callback / refresh actions.

const COMPOSIO_TOOLS_URL = "https://backend.composio.dev/api/v3/tools";

export type FetchedComposioTool = {
  slug: string;
  name: string | null;
  description: string | null;
};

type RawComposioTool = {
  slug?: unknown;
  name?: unknown;
  description?: unknown;
};

type ToolsListResponse = {
  items?: RawComposioTool[];
  next_cursor?: string | null;
};

/**
 * List the curated tool subset Composio exposes for one toolkit
 * (e.g. "slack"). Walks `next_cursor` defensively in case Composio
 * paginates the curated set (currently single-page in practice).
 *
 * Throws on HTTP error so the caller can decide whether to surface
 * the failure to the user (refresh action) or swallow it (connect
 * callback's best-effort prime).
 */
export async function fetchComposioToolkitTools(
  apiKey: string,
  toolkitSlug: string,
): Promise<FetchedComposioTool[]> {
  const out: FetchedComposioTool[] = [];
  let cursor: string | undefined = undefined;
  for (let page = 0; page < 20; page++) {
    const url = new URL(COMPOSIO_TOOLS_URL);
    url.searchParams.set("toolkit_slug", toolkitSlug);
    url.searchParams.set("limit", "500");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Composio tools list failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }
    const body = (await res.json()) as ToolsListResponse;
    for (const t of body.items ?? []) {
      if (typeof t.slug !== "string" || !t.slug) continue;
      out.push({
        slug: t.slug,
        name: typeof t.name === "string" ? t.name : null,
        description:
          typeof t.description === "string" ? t.description : null,
      });
    }
    cursor = body.next_cursor ?? undefined;
    if (!cursor) break;
  }
  return out;
}
