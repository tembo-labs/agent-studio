import { notFound } from "next/navigation";

import { DOCS } from "@/lib/docs-content";

import { DocBody } from "../doc-body";
import { DOC_SLUGS } from "../nav";

export const dynamic = "force-dynamic";

export default async function DocPage({
  params,
}: {
  params: Promise<{ workspace: string; slug: string }>;
}) {
  const { workspace: slug, slug: docSlug } = await params;
  // Only serve pages that are in the nav (and exist in the bundled content).
  if (!DOC_SLUGS.has(docSlug)) notFound();
  const doc = DOCS[docSlug];
  if (!doc) notFound();

  return (
    <article className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-xl font-bold tracking-tight">
          {doc.title}
        </h1>
        {doc.description && (
          <p className="text-foreground-weak text-base">{doc.description}</p>
        )}
      </div>
      <DocBody body={doc.body} workspaceSlug={slug} />
    </article>
  );
}
