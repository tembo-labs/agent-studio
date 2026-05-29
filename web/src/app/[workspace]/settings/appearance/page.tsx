import { notFound } from "next/navigation";

import { Section } from "@/components/section";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { FaviconPicker } from "../favicon-picker";
import { ThemeSettings } from "../theme-settings";

export const dynamic = "force-dynamic";

// Appearance: theme (browser-local) + favicon (workspace-level).
// Both are visual identity knobs; settings adjacent because an
// operator changing one tends to look at the other.

export default async function AppearancePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  return (
    <div className="divide-y divide-[var(--color-border-weak)]">
      <div className="pb-6 first:pt-0">
        <Section
          title="Theme"
          description="Pick a curated theme or roll your own. Changes are stored locally to your browser."
        >
          <ThemeSettings />
        </Section>
      </div>

      <div className="pt-6">
        <Section
          title="Favicon"
          description="What renders in the browser tab. Defaults to the workspace's chosen pattern; upload a PNG/SVG to override."
        >
          <FaviconPicker
            workspaceSlug={workspace.slug}
            currentKind={workspace.faviconKind}
            cacheKey={workspace.updatedAt.getTime().toString()}
          />
        </Section>
      </div>
    </div>
  );
}
