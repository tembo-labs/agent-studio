import { notFound } from "next/navigation";

import { Section } from "@/components/section";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { ChangeModeSetting } from "../change-mode-setting";
import { SecretKeyForm } from "../secret-key-form";
import { SyncGuidanceForm } from "../sync-guidance-form";

export const dynamic = "force-dynamic";

// Tembo Coding Agent: everything that configures the chat-to-PR
// authoring loop — the API key, the agent-guidance files the coding
// agent reads, and how its edits land in the repo. None of this is
// needed to *run* an agent (that's LLM Providers).
export default async function TemboSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const [temboPreview, repo] = await Promise.all([
    getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
    getWorkspaceRepo(workspace.id),
  ]);

  return (
    <div className="divide-y divide-[var(--color-border-weak)]">
      <div className="pb-6 first:pt-0">
        <Section
          title="Tembo API key"
          description={
            <>
              Powers chat-to-PR authoring (new agents, chat-to-edit, Improve)
              through the Tembo Coding Agent. Not needed to run agents. Scoped
              to{" "}
              <span className="text-foreground font-medium">
                {workspace.name}
              </span>{" "}
              only.
            </>
          }
        >
          <SecretKeyForm
            workspaceSlug={workspace.slug}
            kind="tembo_api_key"
            label="Tembo API key"
            placeholder="tembo_pk_…"
            maskedPrefix="tembo_"
            preview={
              temboPreview
                ? {
                    last4: temboPreview.last4,
                    updatedAt: temboPreview.updatedAt.toISOString(),
                  }
                : null
            }
          />
        </Section>
      </div>

      {repo && (
        <div className="py-6">
          <Section
            title="Agent guidance"
            description="Writes (or refreshes) AGENTS.md and the per-framework AGENT_GUIDE.md files into the connected repo. These tell the Tembo Coding Agent how to write valid agent files. Safe to click repeatedly — it only commits when the files are missing or out of date."
          >
            <SyncGuidanceForm workspaceSlug={workspace.slug} />
          </Section>
        </div>
      )}

      <div className="pt-6">
        <Section
          title="Improvements delivery"
          description="How edits from the Improve form ship to your repo. YOLO commits directly to the default branch and is coming in a later release."
        >
          <ChangeModeSetting />
        </Section>
      </div>
    </div>
  );
}
