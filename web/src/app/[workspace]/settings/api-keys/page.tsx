import { notFound } from "next/navigation";

import { Section } from "@/components/section";
import { getPublicOrigin } from "@/lib/config";
import {
  getWorkspaceBySlug,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { SecretKeyForm } from "../secret-key-form";

export const dynamic = "force-dynamic";

// API keys: workspace-level credentials TAS injects into agent
// runs. Each one is its own form so a Tembo key rotation doesn't
// touch the Anthropic preview state. Composio carries an extra
// webhook secret because triggers verify HMAC signatures against
// it.

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const [
    temboPreview,
    anthropicPreview,
    openaiPreview,
    composioPreview,
    composioWebhookSecretPreview,
  ] = await Promise.all([
    getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
    getWorkspaceSecretPreview(workspace.id, "anthropic_api_key"),
    getWorkspaceSecretPreview(workspace.id, "openai_api_key"),
    getWorkspaceSecretPreview(workspace.id, "composio_api_key"),
    getWorkspaceSecretPreview(workspace.id, "composio_webhook_secret"),
  ]);
  const webhookUrl = `${getPublicOrigin()}/api/hooks/composio/${workspace.slug}`;

  return (
    <div className="divide-y divide-[var(--color-border-weak)]">
      <div className="pb-6 first:pt-0">
        <Section
          title="Tembo API key"
          description={
            <>
              Used by this workspace to invoke Tembo services. Scoped to{" "}
              <span className="text-foreground font-medium">
                {workspace.name}
              </span>{" "}
              only — not shared with other workspaces.
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

      <div className="py-6">
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

      <div className="py-6">
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

      <div className="py-6">
        <Section
          title="Composio API key"
          description="Enables Composio-backed connections. Per-user OAuth happens at /connections; the workspace key authenticates every Tool Router session built against this workspace's agents."
        >
          <SecretKeyForm
            workspaceSlug={workspace.slug}
            kind="composio_api_key"
            label="Composio API key"
            placeholder="ak_…"
            maskedPrefix="ak_"
            preview={
              composioPreview
                ? {
                    last4: composioPreview.last4,
                    updatedAt: composioPreview.updatedAt.toISOString(),
                  }
                : null
            }
          />
        </Section>
      </div>

      <div className="pt-6">
        <Section
          title="Composio webhook secret"
          description={
            <>
              HMAC secret Composio signs trigger webhooks with. Point your
              Composio app at{" "}
              <code className="bg-surface rounded px-1 py-0.5 text-sm">
                {webhookUrl}
              </code>{" "}
              and paste the secret here so TAS can verify each delivery.
            </>
          }
        >
          <SecretKeyForm
            workspaceSlug={workspace.slug}
            kind="composio_webhook_secret"
            label="Composio webhook secret"
            placeholder="whsec_…"
            maskedPrefix="whsec_"
            preview={
              composioWebhookSecretPreview
                ? {
                    last4: composioWebhookSecretPreview.last4,
                    updatedAt:
                      composioWebhookSecretPreview.updatedAt.toISOString(),
                  }
                : null
            }
          />
        </Section>
      </div>
    </div>
  );
}
