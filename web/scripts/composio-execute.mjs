#!/usr/bin/env node
//
// Execute a Composio tool directly against the REST API. Use this
// to verify a tool exists + works *before* wiring it into an agent
// spec — the curated tool listing (composio-tools.mjs) often hides
// less-prominent actions, so the only reliable way to confirm a
// tool is actually callable is to try it.
//
// Usage:
//   COMPOSIO_API_KEY=ak_... COMPOSIO_USER_ID=<workspace_uuid>:<user_id> \
//     node web/scripts/composio-execute.mjs <slug> [args_json]
//
// Examples:
//   # No args
//   node web/scripts/composio-execute.mjs ATTIO_LIST_RECORDS
//
//   # With args
//   node web/scripts/composio-execute.mjs ATTIO_RUN_BASIC_REPORT \
//     '{"record_type":"deals","group_by":"stage"}'
//
// COMPOSIO_USER_ID is the composite TAS sends to Composio at run
// time: `${workspace_id}:${user_id}`. Pull it from the running
// workspace by running this in psql:
//
//   SELECT workspace_id || ':' || user_id AS composio_user_id
//     FROM workspace_composio_connection
//    WHERE toolkit_slug = 'attio' AND name = 'tembo'
//    LIMIT 1;

const apiKey = process.env.COMPOSIO_API_KEY;
const userId = process.env.COMPOSIO_USER_ID;
const slug = process.argv[2];
const argsJson = process.argv[3];

if (!apiKey || !userId || !slug) {
  console.error(
    "usage: COMPOSIO_API_KEY=ak_... COMPOSIO_USER_ID=ws:user node composio-execute.mjs <slug> [args_json]",
  );
  process.exit(1);
}

let argsParsed = {};
if (argsJson) {
  try {
    argsParsed = JSON.parse(argsJson);
  } catch (e) {
    console.error(`invalid args JSON: ${e.message}`);
    process.exit(1);
  }
}

const url = `https://backend.composio.dev/api/v3.1/tools/execute/${encodeURIComponent(slug)}`;
const body = {
  user_id: userId,
  arguments: argsParsed,
  // Composio's SDK sometimes requires an explicit toolkit version
  // when not "latest"; this flag lets us skip the check so the
  // script can be run blind.
  dangerously_skip_version_check: true,
};

const res = await fetch(url, {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "content-type": "application/json",
  },
  body: JSON.stringify(body),
});
const text = await res.text();
console.log(`HTTP ${res.status}`);
try {
  const json = JSON.parse(text);
  // Composio returns { successful, data, error?, log_id }. If
  // `successful: false` the action failed *gracefully* — usually
  // a bad argument or missing connected account — and the error
  // field tells you why.
  console.log(JSON.stringify(json, null, 2));
} catch {
  console.log(text);
}
process.exit(res.ok ? 0 : 1);
