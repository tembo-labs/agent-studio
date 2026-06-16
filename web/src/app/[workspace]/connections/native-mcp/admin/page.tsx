import { redirect } from "next/navigation";

// Moved: admin substrate config now lives at /connections/providers.
export default async function RedirectToProviders({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  redirect(`/${slug}/connections/providers`);
}
