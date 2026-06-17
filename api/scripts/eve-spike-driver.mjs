import { Client } from "eve/client";
await import("./.output/server/index.mjs");
const handler = globalThis.__EVE_FETCH__;
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input?.url ?? "");
  if (url.includes("eve.local")) return handler(input instanceof Request ? input : new Request(url, init));
  return realFetch(input, init);
};
const client = new Client({ host: "http://eve.local" });
const session = client.session();
console.error("running turn fully in-process (no socket)...");
const res = await session.send("Reply with exactly: hello world");
const out = await res.result();
console.log("MESSAGE_RESULT:", JSON.stringify(out, null, 2).slice(0, 2000));
