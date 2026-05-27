#!/usr/bin/env node
//
// List every Composio action available for a toolkit, hitting the
// REST API directly so the result is authoritative (the toolkit
// pages on composio.dev can lag behind what's actually shipped).
//
// Usage:
//   COMPOSIO_API_KEY=ak_... node web/scripts/composio-tools.mjs <toolkit> [search]
//
// Examples:
//   COMPOSIO_API_KEY=ak_... node web/scripts/composio-tools.mjs attio
//   COMPOSIO_API_KEY=ak_... node web/scripts/composio-tools.mjs attio report
//   COMPOSIO_API_KEY=ak_... node web/scripts/composio-tools.mjs slack send

const apiKey = process.env.COMPOSIO_API_KEY;
const toolkit = process.argv[2];
const search = process.argv[3]?.toLowerCase();

if (!apiKey || !toolkit) {
  console.error("usage: COMPOSIO_API_KEY=ak_... node composio-tools.mjs <toolkit> [search]");
  process.exit(1);
}

// Composio's /api/v3/tools auto-filters to an "important" curated
// subset when the only filter is `toolkit_slug`. `important=false`
// is NOT honored as an override; the SDK's own logic just omits
// the param. What DOES disable curation: passing a `search` term.
// So if the caller gave us a search, push it to the server (gets
// the full set matching that term). Otherwise we have to live with
// the curated 11-ish results — Composio doesn't expose a clean
// "give me literally everything" knob through this endpoint.
const items = [];
let cursor;
let page = 0;
const usingServerSearch = Boolean(search);
while (true) {
  const url = new URL("https://backend.composio.dev/api/v3/tools");
  url.searchParams.set("toolkit_slug", toolkit);
  url.searchParams.set("limit", "500");
  if (usingServerSearch) url.searchParams.set("search", search);
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const body = await res.json();
  for (const t of body.items ?? []) items.push(t);
  cursor = body.next_cursor ?? undefined;
  page++;
  if (!cursor) break;
  if (page > 20) {
    console.error("paginated past 20 pages — giving up to avoid infinite loop");
    break;
  }
}

// When we ran a server-side search, items is already the matching
// set across the full toolkit. When we didn't, items is whatever
// Composio's curated subset returned — we surface that distinction
// so the caller doesn't conclude "11 actions total" when really
// it's "11 important actions; pass a search term to see more."
if (items.length === 0) {
  const reason = usingServerSearch
    ? `matching "${search}"`
    : "(curated subset — pass a search term to see uncurated)";
  console.log(`No actions found for toolkit=${toolkit} ${reason}.`);
  process.exit(0);
}

for (const t of items) {
  console.log(`${t.slug}`);
  if (t.name && t.name !== t.slug) console.log(`  ${t.name}`);
  if (t.description) console.log(`  ${t.description}`);
  console.log("");
}
const note = usingServerSearch
  ? ` (search="${search}", server-side)`
  : ` (curated/important subset — pass a search term for the full match)`;
console.log(`— ${items.length} action(s)${note}`);
