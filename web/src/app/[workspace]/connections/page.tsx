import { redirect } from "next/navigation";

// Bare /<workspace>/connections → /<workspace>/connections/composio.
// Composio is the broader-coverage substrate so it's the default
// landing; Native MCP is one click away in the left rail.

export default async function ConnectionsIndex({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  redirect(`/${slug}/connections/composio`);
}
