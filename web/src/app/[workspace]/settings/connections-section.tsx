import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import {
  CONNECTION_TYPE_LABELS,
  type ConnectionType,
  type GoogleSheetsMetadata,
  type SlackMetadata,
  type WorkspaceConnection,
} from "@/lib/connections";

import { DisconnectConnectionForm } from "./disconnect-connection-form";

// Settings → Connections section. Lists each supported connection type
// and shows either an "authorize" CTA or the connected account, with
// a Disconnect button. Server component — gets the live list + the
// post-callback banner inputs from the page.

type Props = {
  workspaceSlug: string;
  connections: WorkspaceConnection[];
  slackEnabled: boolean;
  googleEnabled: boolean;
  /** Result of an OAuth callback if the user just came back from one. */
  banner?: {
    connection: ConnectionType;
    result: "ok" | "error";
    detail?: string;
  };
};

export function ConnectionsSection({
  workspaceSlug,
  connections,
  slackEnabled,
  googleEnabled,
  banner,
}: Props) {
  const slack = connections.find((c) => c.type === "slack");
  const google = connections.find((c) => c.type === "google-sheets");

  return (
    <Section
      title="Connections"
      description="External services this workspace's agents can call. Each connection is authorized once here and then referenced by name from any agent that needs it."
    >
      <div id="connections" className="flex flex-col gap-3">
        {banner && (
          <div
            role={banner.result === "error" ? "alert" : undefined}
            className={
              banner.result === "ok"
                ? "border-sentiment-positive bg-[var(--color-sentiment-positive-subtle)] rounded-lg border px-3 py-2 text-sm"
                : "border-sentiment-negative bg-[var(--color-input-error)] rounded-lg border px-3 py-2 text-sm"
            }
          >
            {banner.result === "ok" ? (
              <span className="text-foreground">
                {CONNECTION_TYPE_LABELS[banner.connection]} connected.
              </span>
            ) : (
              <span className="text-foreground">
                Couldn&apos;t connect {CONNECTION_TYPE_LABELS[banner.connection]}
                {banner.detail ? `: ${banner.detail}` : "."}
              </span>
            )}
          </div>
        )}

        <ConnectionRow
          type="slack"
          workspaceSlug={workspaceSlug}
          connection={slack}
          enabled={slackEnabled}
          subtitleForExisting={(c) => {
            const m = c.metadata as SlackMetadata;
            return m.team_name ? `Workspace: ${m.team_name}` : "Connected";
          }}
          missingConfigHint="Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET on this TAS instance to enable Slack."
        />

        <ConnectionRow
          type="google-sheets"
          workspaceSlug={workspaceSlug}
          connection={google}
          enabled={googleEnabled}
          subtitleForExisting={(c) => {
            const m = c.metadata as GoogleSheetsMetadata;
            return m.account_email ?? "Connected";
          }}
          missingConfigHint="Set GOOGLE_CONNECTIONS_CLIENT_ID and GOOGLE_CONNECTIONS_CLIENT_SECRET to enable Google Sheets. Use a separate OAuth client from the sign-in one — different scopes."
        />
      </div>
    </Section>
  );
}

function ConnectionRow({
  type,
  workspaceSlug,
  connection,
  enabled,
  subtitleForExisting,
  missingConfigHint,
}: {
  type: ConnectionType;
  workspaceSlug: string;
  connection: WorkspaceConnection | undefined;
  enabled: boolean;
  subtitleForExisting: (c: WorkspaceConnection) => string;
  missingConfigHint: string;
}) {
  const label = CONNECTION_TYPE_LABELS[type];
  const authorizeHref = `/api/connections/${type === "google-sheets" ? "google" : type}/authorize?workspace=${encodeURIComponent(workspaceSlug)}`;

  return (
    <div className="bg-surface border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-foreground text-sm font-medium">{label}</span>
        {connection ? (
          <span className="text-foreground-muted truncate text-xs">
            {subtitleForExisting(connection)} · updated{" "}
            <LocalTime iso={connection.updatedAt.toISOString()} />
          </span>
        ) : enabled ? (
          <span className="text-foreground-muted text-xs">Not connected.</span>
        ) : (
          <span className="text-foreground-weak text-xs">
            {missingConfigHint}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {enabled && (
          <Link
            href={authorizeHref}
            className="text-foreground hover:text-foreground-title text-sm font-medium hover:underline"
          >
            {connection ? "Reconnect" : "Connect"}
          </Link>
        )}
        {connection && (
          <DisconnectConnectionForm
            workspaceSlug={workspaceSlug}
            connectionId={connection.id}
          />
        )}
      </div>
    </div>
  );
}
