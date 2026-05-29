import { redirect } from "next/navigation";

// Bare /<workspace>/connections → /<workspace>/connections/native-mcp.
// Native MCP leads because it's the substrate we'd reach for first
// for any provider that publishes an official MCP server (richer
// tools, schema-aware operations). Composio is one click away in
// the left rail for everything that doesn't.

export default async function ConnectionsIndex({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  redirect(`/${slug}/connections/native-mcp`);
}
