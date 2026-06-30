import Link from "next/link";
import { notFound } from "next/navigation";

import { Section } from "@/components/section";
import { listAnthropicSkills } from "@/lib/anthropic-skills";
import { popularSkillsSh } from "@/lib/skillssh-api";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  getWorkspaceSecretPlaintext,
} from "@/lib/workspace";
import { listInstalledSkills } from "@/lib/workspace-skills";

import { KnowledgeWorkSkillsBrowser } from "../knowledge-work-skills-browser";
import { SkillsCatalogBrowser } from "../skills-catalog-browser";
import {
  AddFromGitHubForm,
  ImportFromClaudeForm,
  UploadSkillForm,
  type ImportableSkill,
} from "../skills-forms";

export const dynamic = "force-dynamic";

// Add a skill: browse skills.sh, paste a slug/GitHub URL, upload a .zip, or
// import from the Claude Skills API. Split out from the Skills list so the list
// page stays a clean inventory and this is reached via "+ New Skill".
export default async function NewSkillPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    // Adding requires a repo (skills are committed there). Bounce the user to
    // the list page, which explains how to connect one.
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
        <p className="text-foreground-weak text-sm">
          Connect a GitHub repository in{" "}
          <Link
            href={`/${slug}/settings/repository`}
            className="text-foreground font-medium underline underline-offset-2"
          >
            Settings → Repository
          </Link>{" "}
          before adding skills.
        </p>
      </div>
    );
  }

  const installed = await listInstalledSkills(workspace.id);
  const installedNames = installed.map((s) => s.name);

  const popular = await popularSkillsSh();
  const popularSkills = popular.ok ? popular.skills : [];

  const anthropicKey = await getWorkspaceSecretPlaintext(
    workspace.id,
    "anthropic_api_key",
  );
  let importable: ImportableSkill[] = [];
  let importError: string | null = null;
  if (!anthropicKey) {
    importError =
      "Set an Anthropic API key under Settings → LLM Providers to import skills from the Claude API.";
  } else {
    const res = await listAnthropicSkills(anthropicKey);
    if (res.ok) {
      importable = res.skills.map((s) => ({
        id: s.id,
        displayTitle: s.displayTitle,
        source: s.source,
      }));
    } else {
      importError = res.error;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <Link
          href={`/${slug}/skills`}
          className="text-foreground-weak text-sm hover:underline"
        >
          ← Skills
        </Link>
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          New skill
        </h1>
        <p className="text-foreground-weak text-base">
          Install a skill into <code>skills/</code> in your connected repo.
          Agents opt in with their <code>skills:</code> field.
        </p>
      </div>

      <div className="divide-y divide-[var(--color-border-weak)]">
        <div className="pb-6">
          <Section
            title="Anthropic knowledge-work skills"
            description="Role-specific Agent Skills from anthropics/knowledge-work-plugins — domain expertise your agents draw on. Install with one click."
          >
            <KnowledgeWorkSkillsBrowser
              workspaceSlug={slug}
              installed={installedNames}
            />
          </Section>
        </div>
        <div className="py-6">
          <Section
            title="Browse skills.sh"
            description="Search the open Agent Skills directory and install with one click."
          >
            <SkillsCatalogBrowser
              workspaceSlug={slug}
              popular={popularSkills}
              installed={installedNames}
            />
            <details className="mt-4">
              <summary className="text-foreground-weak hover:text-foreground cursor-pointer text-sm">
                Install from another source (skills.sh slug or GitHub URL)
              </summary>
              <div className="mt-3">
                <AddFromGitHubForm workspaceSlug={slug} />
              </div>
            </details>
          </Section>
        </div>
        <div className="py-6">
          <Section
            title="Upload a custom skill"
            description="Upload your own skill bundle as a .zip (a folder with a SKILL.md)."
          >
            <UploadSkillForm workspaceSlug={slug} />
          </Section>
        </div>
        <div className="pt-6">
          <Section
            title="Import from the Claude API"
            description="Copy a skill your team created via the Claude Skills API into this repo."
          >
            <ImportFromClaudeForm
              workspaceSlug={slug}
              skills={importable}
              error={importError}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
