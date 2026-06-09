import { redirect } from "next/navigation";

import { DOC_HOME_SLUG } from "./nav";

// /docs → the landing page (Introduction).
export default async function DocsIndexPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  redirect(`/${slug}/docs/${DOC_HOME_SLUG}`);
}
