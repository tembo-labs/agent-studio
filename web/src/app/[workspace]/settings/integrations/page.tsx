import { notFound } from "next/navigation";

import { Section } from "@/components/section";
import { getPublicOrigin } from "@/lib/config";
import {
  getWorkspaceBySlug,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { SecretKeyForm } from "../secret-key-form";

export const dynamic = "force-dynamic";

// Integrations: external-service credentials. Composio (connections +
// the trigger webhook secret) first, then Tembo (chat-to-PR authoring)
// last. Distinct from LLM Providers — none of these are needed to run
// an agent.
export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const [composioPreview, composioWebhookSecretPreview, temboPreview] =
    await Promise.all([
      getWorkspaceSecretPreview(workspace.id, "composio_api_key"),
      getWorkspaceSecretPreview(workspace.id, "composio_webhook_secret"),
      getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
    ]);
  const webhookUrl = `${getPublicOrigin()}/api/hooks/composio/${workspace.slug}`;

  return (
    <div className="divide-y divide-[var(--color-border-weak)]">
      <div className="pb-6 first:pt-0">
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

      <div className="py-6">
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

      <div className="pt-6">
        <Section
          title="Tembo API key"
          description={
            <>
              Powers chat-to-PR authoring (new agents, chat-to-edit, Improve)
              through Tembo. Not needed to run agents. Scoped to{" "}
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
    </div>
  );
}
