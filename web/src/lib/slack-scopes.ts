// Bot scopes the TAS Slack app requests. Kept in one place (no
// "server-only" so the client manifest builder can import it too) so the
// generated manifest and the OAuth install URL never drift:
//   commands           — receive the /tas slash command
//   chat:write         — post run results back into the thread
//   app_mentions:read  — receive @bot mentions (events)
//   im:history         — read DMs to the bot (events)
//   users:read[.email] — map a Slack user → a TAS member by email
export const SLACK_BOT_SCOPES = [
  "commands",
  "chat:write",
  "app_mentions:read",
  "im:history",
  "users:read",
  "users:read.email",
] as const;
