import { redirect } from "next/navigation";

// Bare /<workspace>/settings → /<workspace>/settings/providers. The
// SettingsNav highlights "LLM Providers" on the bare path (handled in
// the nav's active-link check) so a momentary URL flicker doesn't
// leave the rail confused.

export default async function SettingsIndex({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  redirect(`/${slug}/settings/providers`);
}
