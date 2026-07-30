import { notFound } from "next/navigation";

import { Section } from "@/components/section";
import { authorizeWorkspace } from "@/lib/auth-server";
import { getPersonalTemboPreview } from "@/lib/tembo-credentials";
import {
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { ChangeModeSetting } from "../change-mode-setting";
import { PersonalTemboKeyForm } from "../personal-tembo-key-form";
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
  const auth = await authorizeWorkspace(slug);
  if (!auth.ok) notFound();
  const { workspace, userId } = auth;

  const [personalPreview, temboPreview] = await Promise.all([
    getPersonalTemboPreview(workspace.id, userId),
    getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
  ]);

  return (
    <div className="divide-y divide-[var(--color-border-weak)]">
      <div className="pb-6 first:pt-0">
        <Section
          title="Your Tembo account"
          description="Connect your own Tembo API key so coding-agent sessions and pull requests use your Tembo identity. If you do not connect one, TAS uses the workspace fallback account below."
        >
          <PersonalTemboKeyForm
            workspaceSlug={workspace.slug}
            preview={
              personalPreview
                ? {
                    last4: personalPreview.last4,
                    updatedAt: personalPreview.updatedAt.toISOString(),
                  }
                : null
            }
          />
        </Section>
      </div>

      <div className="py-6">
        <Section
          title="Workspace fallback account"
          description={
            <>
              Used for members who have not connected their own Tembo account.
              This preserves shared chat-to-PR authoring for{" "}
              <span className="text-foreground font-medium">
                {workspace.name}
              </span>{" "}
              and is not needed to run agents.
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
          description="How the coding agent's changes (new agents, chat-to-edit, Improve) land in your repo. Always PR opens a reviewable pull request; YOLO commits straight to the default branch."
        >
          <ChangeModeSetting
            workspaceSlug={workspace.slug}
            current={workspace.commitMode}
          />
        </Section>
      </div>
    </div>
  );
}
