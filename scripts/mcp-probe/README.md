# TAS Native MCP catalog — 2026-07 sweep tooling + probe ledger

Working set from the batch-3 catalog expansion
([tembo/agent-studio#310](https://github.com/tembo/agent-studio/issues/310),
PR [#313](https://github.com/tembo/agent-studio/pull/313)). Preserved so
batch 4 doesn't start from scratch. All probes ran unauthenticated from a
Tembo sandbox on **2026-07-18**.

## Files

| File | What it is |
| --- | --- |
| `probe.sh` | Shallow probe of one candidate: MCP `initialize` POST (expects 401 + `WWW-Authenticate` for OAuth servers) → `/.well-known/oauth-protected-resource` (path-aware, then origin root) → auth-server metadata → DCR check. Emits one TSV row. |
| `probe2.sh` | Deep probe: emits one JSON object per provider with every OAuth origin the TAS catalog + Rust allowlist need (`authorization_endpoint`, `token_endpoint`, `registration_endpoint` origins). |
| `driver-shallow.py` / `driver-deep.py` | Concurrent drivers that fan the probes over a candidate list. |
| `generate.mjs` | Generates the `mcp-providers.ts` catalog entries (union member, entry object, category wiring) and the Rust allowlist tuples from the deep-probe JSON + a hand-curated metadata table (displayName, auth mode, category, caveat notes). This is the expensive-to-recreate piece. |
| `fetch-art.mjs` | Logo fetcher: tries vendor favicon/apple-touch/known CDN paths, falls back to Google s2 favicons, md5-compares against the s2 "default globe" to reject placeholders, validates PNG/ICO/SVG/JPG magic bytes. |
| `probe-results-2026-07-18.tsv` | **Full shallow-probe ledger: all 216 candidates**, including the ~80 that did not make the catalog. Columns: slug, MCP URL, `initialize` status, protected-resource status (+ which URL variant hit), auth server, DCR, notes. |

## Reading the ledger

- `200/…` or `401 + protected-resource 200` → live hosted server (candidates for the catalog).
- `401/401` or `401/404` with no metadata → auth-gated, discovery inconclusive — re-probe candidates.
- `404/404`, `405`, `ERR` → no hosted MCP server at that URL as of 2026-07-18 — the negative-result baseline for the next sweep (probe URLs are the best-known guess from registry/directory/community lists, so a vendor may still launch elsewhere).

## Reproducing

```bash
cd scripts/mcp-probe
mkdir -p /tmp/mcp-probe                # probe.sh scratch dir
./probe.sh <slug> <mcp_url>            # one TSV row to stdout
./probe2.sh <slug> <mcp_url>           # one JSON object to stdout
node generate.mjs                      # reads deep/*.json, writes gen-*.txt fragments
```

Methodology is also documented in the batch-3 header of
`web/src/lib/mcp-providers.ts`.
