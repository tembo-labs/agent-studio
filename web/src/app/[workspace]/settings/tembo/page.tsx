import { notFound } from "next/navigation";

import { Section } from "@/components/section";
import {
  getWorkspaceBySlug,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { ChangeModeSetting } from "../change-mode-setting";
import { SecretKeyForm } from "../secret-key-form";

export const dynamic = "force-dynamic";

// Tembo Coding Agent: the chat-to-PR authoring config — the API key and
// how the coding agent's edits land in the repo (Improvements delivery).
// None of this is needed to *run* an agent (that's LLM Providers). The
// agent-guidance file refresh lives on Repository (a direct repo write,
// no Tembo needed).
export default async function TemboSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const temboPreview = await getWorkspaceSecretPreview(
    workspace.id,
    "tembo_api_key",
  );

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
            placeholder="Paste your Tembo API key"
            maskedPrefix=""
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
