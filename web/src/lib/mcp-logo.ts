// Resolve a provider slug to its logo URL.
//
// Most provider logos come from Composio's public logo CDN (every Composio
// toolkit slug — slack, linear, attio, hubspot, … — resolves there, and our
// native-MCP slugs mostly reuse those same slugs). A few of our native-only
// MCPs aren't in Composio's catalog (Pylon, Dialed) or are our own service
// (Tembo Agent Studio), so the CDN 404s for them — we ship local art instead.
//
// Pure data + string building (no server-only deps) so both server components
// and the client logo widgets can call it. Callers keep their own onError
// fallback to a generic glyph, so a missing/blocked URL still degrades cleanly.

const LOCAL_LOGOS: Record<string, string> = {
  "tembo-agent-studio": "/favicons/default-tembo.svg",
  pylon: "/mcp-logos/pylon.svg",
  dialed: "/mcp-logos/dialed.svg",
  amplemarket: "/mcp-logos/amplemarket.svg",
};

export function mcpLogoUrl(slug: string): string {
  const s = slug.trim().toLowerCase();
  return (
    LOCAL_LOGOS[s] ?? `https://logos.composio.dev/api/${encodeURIComponent(s)}`
  );
}
