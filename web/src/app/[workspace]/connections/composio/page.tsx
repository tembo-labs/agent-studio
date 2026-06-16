import { redirect } from "next/navigation";

// Moved: the Connections area is now a single list. Old substrate tab → list.
export default async function RedirectToConnections({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  redirect(`/${slug}/connections`);
}
