import { notFound } from "next/navigation";

import { Section } from "@/components/section";
import {
  getWorkspaceBySlug,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { SecretKeyForm } from "../secret-key-form";

export const dynamic = "force-dynamic";

// LLM Providers: the model API keys agents *run* on. An agent's
// `model:` field (anthropic:* / openai:*) selects which key the runtime
// uses. Each key is its own form so rotating one doesn't touch the
// other's preview state.
export default async function ProvidersPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const [anthropicPreview, openaiPreview] = await Promise.all([
    getWorkspaceSecretPreview(workspace.id, "anthropic_api_key"),
    getWorkspaceSecretPreview(workspace.id, "openai_api_key"),
  ]);

  return (
    <div className="divide-y divide-[var(--color-border-weak)]">
      <div className="pb-6 first:pt-0">
        <Section
          title="Anthropic API key"
          description="Required for any agent that uses an anthropic:* model."
        >
          <SecretKeyForm
            workspaceSlug={workspace.slug}
            kind="anthropic_api_key"
            label="Anthropic API key"
            placeholder="sk-ant-…"
            maskedPrefix="sk-ant-"
            preview={
              anthropicPreview
                ? {
                    last4: anthropicPreview.last4,
                    updatedAt: anthropicPreview.updatedAt.toISOString(),
                  }
                : null
            }
          />
        </Section>
      </div>

      <div className="pt-6">
        <Section
          title="OpenAI API key"
          description="Required for any agent that uses an openai:* model."
        >
          <SecretKeyForm
            workspaceSlug={workspace.slug}
            kind="openai_api_key"
            label="OpenAI API key"
            placeholder="sk-…"
            maskedPrefix="sk-"
            preview={
              openaiPreview
                ? {
                    last4: openaiPreview.last4,
                    updatedAt: openaiPreview.updatedAt.toISOString(),
                  }
                : null
            }
          />
        </Section>
      </div>
    </div>
  );
}
