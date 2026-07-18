#!/usr/bin/env bash
# Probe a candidate hosted MCP server the way TAS native-mcp discovery does.
# Usage: probe.sh <slug> <mcp_url>
# Output: one TSV line: slug \t mcp_url \t mcp_status \t prr_status \t auth_server \t dcr \t notes
set -u
slug="$1"; url="$2"
UA="tembo-agent-studio-catalog-probe/1.0"
TO=12

origin=$(printf '%s' "$url" | sed -E 's#^(https://[^/]+).*#\1#')
path=$(printf '%s' "$url" | sed -E 's#^https://[^/]+##')

# 1) POST initialize to the MCP URL — expect 401 + WWW-Authenticate for OAuth servers
init='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
mcp_resp=$(curl -sS -o /tmp/mcp-probe/body.$$ -w '%{http_code}' --max-time $TO -X POST "$url" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -H "User-Agent: $UA" -D /tmp/mcp-probe/hdr.$$ -d "$init" 2>/dev/null) || mcp_resp="ERR"
www=$(grep -i '^www-authenticate:' /tmp/mcp-probe/hdr.$$ 2>/dev/null | head -1 | tr -d '\r' | cut -c1-160)

# 2) Protected-resource metadata: path-aware first, then origin root
prr=""
prr_status=""
for prurl in "$origin/.well-known/oauth-protected-resource$path" "$origin/.well-known/oauth-protected-resource"; do
  code=$(curl -sS -o /tmp/mcp-probe/prr.$$ -w '%{http_code}' --max-time $TO -H "User-Agent: $UA" -H "MCP-Protocol-Version: 2025-06-18" "$prurl" 2>/dev/null) || code="ERR"
  if [ "$code" = "200" ] && jq -e . /tmp/mcp-probe/prr.$$ >/dev/null 2>&1; then
    prr=$(cat /tmp/mcp-probe/prr.$$); prr_status="200 ($prurl)"; break
  fi
  prr_status="$code"
done

auth_server=$(printf '%s' "$prr" | jq -r '.authorization_servers[0] // empty' 2>/dev/null)

# 3) Auth-server metadata → DCR?
dcr="n/a"
if [ -n "$auth_server" ]; then
  as_origin=$(printf '%s' "$auth_server" | sed -E 's#^(https://[^/]+).*#\1#')
  as_path=$(printf '%s' "$auth_server" | sed -E 's#^https://[^/]+##; s#/$##')
  dcr="no"
  for asurl in "$as_origin/.well-known/oauth-authorization-server$as_path" "$as_origin/.well-known/openid-configuration$as_path" "$auth_server/.well-known/oauth-authorization-server" "$auth_server/.well-known/openid-configuration"; do
    meta=$(curl -sS --max-time $TO -H "User-Agent: $UA" "$asurl" 2>/dev/null)
    reg=$(printf '%s' "$meta" | jq -r '.registration_endpoint // empty' 2>/dev/null)
    if [ -n "$reg" ]; then dcr="yes ($reg)"; break; fi
  done
fi

notes=""
[ -n "$www" ] && notes="www-auth: $www"
printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$slug" "$url" "$mcp_resp" "${prr_status:-none}" "${auth_server:-none}" "$dcr" "$notes"
rm -f /tmp/mcp-probe/body.$$ /tmp/mcp-probe/hdr.$$ /tmp/mcp-probe/prr.$$
