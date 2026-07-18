#!/usr/bin/env bash
# Deep probe: emit one JSON object per provider with every OAuth origin the
# TAS catalog + Rust allowlist need.
# Usage: probe2.sh <slug> <mcp_url>
set -u
slug="$1"; url="$2"
UA="tembo-agent-studio-catalog-probe/1.0"
TO=15
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

origin=$(printf '%s' "$url" | sed -E 's#^(https://[^/]+).*#\1#')
path=$(printf '%s' "$url" | sed -E 's#^https://[^/]+##; s#/$##')

# Protected-resource metadata: path-aware first, then origin root
prr="{}"
for prurl in "$origin/.well-known/oauth-protected-resource$path" "$origin/.well-known/oauth-protected-resource"; do
  code=$(curl -sS -o "$tmp/prr" -w '%{http_code}' --max-time $TO -H "User-Agent: $UA" -H "MCP-Protocol-Version: 2025-06-18" "$prurl" 2>/dev/null) || code=ERR
  if [ "$code" = "200" ] && jq -e . "$tmp/prr" >/dev/null 2>&1; then prr=$(cat "$tmp/prr"); break; fi
done

as_list=$(printf '%s' "$prr" | jq -c '.authorization_servers // []' 2>/dev/null)
scopes=$(printf '%s' "$prr" | jq -c '.scopes_supported // []' 2>/dev/null)

# Fetch metadata for the FIRST auth server (what TAS uses)
as0=$(printf '%s' "$prr" | jq -r '.authorization_servers[0] // empty' 2>/dev/null)
meta="{}"
if [ -n "$as0" ]; then
  as_origin=$(printf '%s' "$as0" | sed -E 's#^(https://[^/]+).*#\1#')
  as_path=$(printf '%s' "$as0" | sed -E 's#^https://[^/]+##; s#/$##')
  for asurl in "$as_origin/.well-known/oauth-authorization-server$as_path" "$as_origin/.well-known/openid-configuration$as_path" "${as0%/}/.well-known/oauth-authorization-server" "${as0%/}/.well-known/openid-configuration"; do
    m=$(curl -sS --max-time $TO -H "User-Agent: $UA" "$asurl" 2>/dev/null)
    if printf '%s' "$m" | jq -e '.token_endpoint // .authorization_endpoint' >/dev/null 2>&1; then meta=$m; break; fi
  done
fi

jq -cn --arg slug "$slug" --arg url "$url" \
  --argjson as "$as_list" --argjson scopes "$scopes" --argjson meta "$meta" '
  def orig: if . == null or . == "" then null else (capture("^(?<o>https://[^/]+)").o) end;
  {slug: $slug, url: $url,
   authorization_servers: $as,
   scopes_supported: $scopes,
   issuer: ($meta.issuer // null),
   authorize_origin: (($meta.authorization_endpoint // null) | orig),
   token_origin: (($meta.token_endpoint // null) | orig),
   registration_origin: (($meta.registration_endpoint // null) | orig),
   registration_endpoint: ($meta.registration_endpoint // null),
   auth_methods: ($meta.token_endpoint_auth_methods_supported // null),
   grants: ($meta.grant_types_supported // null)}'
