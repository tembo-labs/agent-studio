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

import { SkillsCatalogBrowser } from "./skills-catalog-browser";
import {
  AddFromGitHubForm,
  ImportFromClaudeForm,
  RemoveSkillForm,
  UploadSkillForm,
  type ImportableSkill,
} from "./skills-forms";

export const dynamic = "force-dynamic";

// Agent Skills: reusable SKILL.md folders the model can load + run. They live in
// the connected repo under skills/<name>/; agents opt in via their `skills:`
// field. Install from skills.sh, a custom .zip, or import from the Claude
// Skills API. Skills run locally at run time (pydantic-ai-skills) — no Anthropic
// sandbox — and work with any model.
export default async function SkillsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const repo = await getWorkspaceRepo(workspace.id);
  const installed = repo ? await listInstalledSkills(workspace.id) : [];
  const installedNames = installed.map((s) => s.name);

  // Popular skills from the live skills.sh directory (search is client-side).
  const popular = repo ? await popularSkillsSh() : { ok: false as const, error: "" };
  const popularSkills = popular.ok ? popular.skills : [];

  // Best-effort list of the org's Claude API skills for the import dropdown.
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
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Skills
        </h1>
        <p className="text-foreground-weak text-base">
          Reusable Agent Skills (SKILL.md folders) committed to your repo under{" "}
          <code>skills/</code>. An agent opts in with a{" "}
          <code>skills:</code> field; the runner mounts them so the model can
          follow their instructions and run their scripts — locally, with any
          model.
        </p>
      </div>

      {!repo ? (
        <div className="border-border bg-surface-raised rounded-lg border p-4 text-sm">
          <p className="text-foreground-weak">
            Connect a GitHub repository in{" "}
            <Link
              href={`/${slug}/settings/repository`}
              className="text-foreground font-medium underline underline-offset-2"
            >
              Settings → Repository
            </Link>{" "}
            — skills are stored there alongside your agents.
          </p>
        </div>
      ) : (
        <>
          <Section
            title="Installed"
            description="Skills in this repo. Reference one from an agent's `skills:` field to opt in."
          >
            {installed.length === 0 ? (
              <p className="text-foreground-weak text-sm">
                No skills installed yet. Add one below.
              </p>
            ) : (
              <ul className="divide-border-weak flex flex-col divide-y rounded-lg border border-[var(--color-border-weak)] bg-surface-raised">
                {installed.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-start justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 flex-col">
                      <code className="text-foreground text-sm font-medium">
                        {s.name}
                      </code>
                      {s.description && (
                        <span className="text-foreground-weak line-clamp-2 text-sm">
                          {s.description}
                        </span>
                      )}
                    </div>
                    <RemoveSkillForm workspaceSlug={slug} name={s.name} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="divide-y divide-[var(--color-border-weak)]">
            <div className="pb-6">
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
        </>
      )}
    </div>
  );
}
