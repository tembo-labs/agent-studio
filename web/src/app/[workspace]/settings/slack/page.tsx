import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Slack apps moved out of Settings into the Build menu (Build → Slack apps).
// Keep this path as a redirect so old bookmarks/links still land in the right
// place.
export default async function SlackSettingsRedirect({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  redirect(`/${slug}/slack-apps`);
}
