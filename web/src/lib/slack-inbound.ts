import "server-only";

import type { NextRequest } from "next/server";

import {
  getSlackAppById,
  getSlackAppSecrets,
  type SlackApp,
  type SlackAppSecrets,
} from "@/lib/slack-apps";
import { verifySlackRequest } from "@/lib/slack-verify";

// Shared front-door for the three inbound Slack routes (commands, events,
// interactivity). Reads the raw body (the signature is over these exact
// bytes — never parse first), resolves the app by its path id, decrypts
// its signing secret + bot token, and verifies the Slack signature.

export type SlackInboundAuth =
  | {
      ok: true;
      app: SlackApp;
      secrets: SlackAppSecrets;
      // Null until the app is installed. Present for any post-install
      // traffic (commands, interactivity, events); callers that must talk
      // back to Slack should bail when it's missing.
      botToken: string | null;
      rawBody: string;
    }
  | { ok: false; status: number };

export async function authenticateSlackRequest(
  request: NextRequest,
  appId: string,
): Promise<SlackInboundAuth> {
  const rawBody = await request.text();
  const app = await getSlackAppById(appId);
  if (!app) return { ok: false, status: 404 };

  const secrets = await getSlackAppSecrets(appId);
  if (!secrets?.signingSecret) return { ok: false, status: 412 };

  const result = verifySlackRequest({
    signingSecret: secrets.signingSecret,
    rawBody,
    signature: request.headers.get("x-slack-signature"),
    timestamp: request.headers.get("x-slack-request-timestamp"),
  });
  if (!result.ok) return { ok: false, status: 401 };

  // Bot token may be null pre-install — the events url_verification
  // handshake happens before "Add to Slack". Callers that need it check.
  return { ok: true, app, secrets, botToken: secrets.botToken, rawBody };
}
