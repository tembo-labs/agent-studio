import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { toolkitLabel } from "@/lib/composio";
import { type WorkspaceComposioConnection } from "@/lib/composio-connections";
import { type WorkspaceTrigger } from "@/lib/triggers-db";

import { DeleteTriggerForm } from "./delete-trigger-form";
import { ToggleTriggerForm } from "./toggle-trigger-form";
import { TriggerForm } from "./trigger-form";

// Per-agent Triggers section. Sits above Automations on the agent
// detail page. Each row is a Composio-managed event subscription
// pointed at this agent; one row per (toolkit, trigger_type,
// connection) tuple. The create form at the bottom takes a free-text
// trigger slug for v0.3 — a schema-driven picker can land later once
// we know what fields per-toolkit forms actually want.

type Props = {
  workspaceSlug: string;
  agentName: string;
  triggers: WorkspaceTrigger[];
  myConnections: WorkspaceComposioConnection[];
  webhookSecretConfigured: boolean;
  composioApiKeyConfigured: boolean;
};

export function TriggersSection({
  workspaceSlug,
  agentName,
  triggers,
  myConnections,
  webhookSecretConfigured,
  composioApiKeyConfigured,
}: Props) {
  return (
    <Section
      title="Triggers"
      description="Events from connected services that fire this agent. Composio handles the per-provider subscription; TAS receives a signed webhook and queues a run."
    >
      {!composioApiKeyConfigured && (
        <PreconditionNotice
          tone="alert"
          text="Set a Composio API key in Settings before creating triggers."
        />
      )}
      {composioApiKeyConfigured && !webhookSecretConfigured && (
        <PreconditionNotice
          tone="warn"
          text="Add a Composio webhook secret in Settings so inbound events can be verified."
        />
      )}

      {triggers.length === 0 ? (
        <p className="text-foreground-weak rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm">
          No triggers yet. Use the form below to subscribe one.
        </p>
      ) : (
        <ul className="divide-border flex flex-col divide-y border-y border-[var(--color-border)]">
          {triggers.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {t.enabled ? (
                    t.lastFireError ? (
                      <Badge variant="red" size="small">
                        Error
                      </Badge>
                    ) : (
                      <Badge variant="green" size="small">
                        On
                      </Badge>
                    )
                  ) : (
                    <Badge variant="gray" size="small">
                      Off
                    </Badge>
                  )}
                  <span className="text-foreground text-sm font-medium">
                    {toolkitLabel(t.toolkitSlug)}
                  </span>
                  <code className="text-foreground-muted text-sm">
                    {t.triggerType}
                  </code>
                </div>
                <p className="text-foreground-weak text-sm">
                  {t.lastFiredAt ? (
                    <>
                      Last fired <LocalTime iso={t.lastFiredAt.toISOString()} style="relative" />
                    </>
                  ) : (
                    "Never fired"
                  )}
                  {t.lastFireError ? (
                    <span className="text-sentiment-negative">
                      {" · "}
                      {t.lastFireError}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <ToggleTriggerForm
                  workspaceSlug={workspaceSlug}
                  id={t.id}
                  nextEnabled={!t.enabled}
                />
                <DeleteTriggerForm workspaceSlug={workspaceSlug} id={t.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-4">
        <TriggerForm
          workspaceSlug={workspaceSlug}
          agentName={agentName}
          connections={myConnections.map((c) => ({
            id: c.id,
            toolkit: c.toolkit,
            name: c.name,
            label: `${toolkitLabel(c.toolkit)} · ${c.name}`,
          }))}
          disabled={!composioApiKeyConfigured}
        />
      </div>
    </Section>
  );
}

function PreconditionNotice({
  tone,
  text,
}: {
  tone: "warn" | "alert";
  text: string;
}) {
  const styles =
    tone === "alert"
      ? "border-sentiment-negative bg-[var(--color-input-error)]"
      : "border-[var(--color-border-sentiment-caution)] bg-[var(--color-sentiment-caution-subtle)]";
  return (
    <div className={`mb-3 rounded-lg border px-3 py-2 text-sm ${styles}`}>
      <span className="text-foreground">{text}</span>
    </div>
  );
}
