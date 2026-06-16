import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DOCS } from "@/lib/docs-content";
import { getRepoStars, REPO_URL } from "@/lib/repo-stars";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

import { DocsNav } from "./docs-nav";
import { DocsSearch, type DocSearchEntry } from "./docs-search";
import { DOC_SLUGS } from "./nav";

// In-app documentation shell — the published user manual, bundled with the app
// so it matches the running version exactly. Two-column layout like Settings /
// Connections; the audience-split nav is a sticky left rail (stays in view as
// the page scrolls), with search top-right and a GitHub link pegged to the
// rail's bottom.
export default async function DocsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  if (!(await userIsMember(workspace.id, session.user.id))) notFound();

  const stars = await getRepoStars();

  // Lightweight search index over the bundled docs (title + description + a
  // plaintext slice of each page).
  const searchIndex: DocSearchEntry[] = [...DOC_SLUGS]
    .filter((s) => DOCS[s])
    .map((s) => ({
      slug: s,
      title: DOCS[s].title,
      description: DOCS[s].description,
      text: plainText(DOCS[s].body).slice(0, 1500),
    }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Documentation
        </h1>
        <DocsSearch workspaceSlug={workspace.slug} index={searchIndex} />
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
        <div className="sm:sticky sm:top-8 sm:h-[calc(100dvh-4rem)] sm:w-60 sm:shrink-0">
          <DocsNav
            workspaceSlug={workspace.slug}
            repoUrl={REPO_URL}
            starCount={stars}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}

// Strip markdown to plaintext for search matching + snippets.
function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\s|-]+/gm, " ")
    .replace(/[*_~`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
