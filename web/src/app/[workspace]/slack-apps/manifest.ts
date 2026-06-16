import type { SlackApp } from "@/lib/slack-apps";
import { SLACK_BOT_SCOPES } from "@/lib/slack-scopes";

// Slack manifest prefilled with this app's TAS request URLs + scopes. The
// admin pastes it into "Create app from manifest" in Slack.
export function manifestJson(app: SlackApp, origin: string): string {
  const base = `${origin}/api/slack/${app.id}`;
  return JSON.stringify(
    {
      display_information: { name: app.name },
      features: {
        bot_user: { display_name: app.name, always_online: true },
        app_home: {
          home_tab_enabled: true,
          messages_tab_enabled: true,
          messages_tab_read_only_enabled: false,
        },
        slash_commands: [
          {
            command: "/tas",
            url: `${base}/commands`,
            description: "Launch a TAS agent",
            usage_hint: "[agent] [input]",
            should_escape: false,
          },
        ],
        shortcuts: [
          {
            name: "Run agent on this message",
            type: "message",
            callback_id: "tas_run_on_message",
            description: "Launch a TAS agent with this message as its input",
          },
        ],
      },
      oauth_config: {
        redirect_urls: [`${base}/callback`],
        scopes: { bot: [...SLACK_BOT_SCOPES] },
      },
      settings: {
        event_subscriptions: {
          request_url: `${base}/events`,
          bot_events: ["app_mention", "message.im", "app_home_opened"],
        },
        interactivity: { is_enabled: true, request_url: `${base}/interactivity` },
        org_deploy_enabled: false,
        socket_mode_enabled: false,
        token_rotation_enabled: false,
      },
    },
    null,
    2,
  );
}

// Owner-picker option label disambiguation: append the email only when a
// display name is shared by more than one member, so two "John Smith"s stay
// distinguishable; otherwise just the name, or the email when unnamed.
export function toMemberOptions(
  members: { userId: string; name: string | null; email: string }[],
): { userId: string; label: string }[] {
  const nameCounts = new Map<string, number>();
  for (const m of members) {
    if (m.name) nameCounts.set(m.name, (nameCounts.get(m.name) ?? 0) + 1);
  }
  return members.map((m) => ({
    userId: m.userId,
    label: m.name
      ? (nameCounts.get(m.name) ?? 0) > 1
        ? `${m.name} (${m.email})`
        : m.name
      : m.email,
  }));
}
