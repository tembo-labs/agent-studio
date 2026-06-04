import "server-only";

import { detectFormat } from "@/lib/agent-format";
import { createRun } from "@/lib/runs-api";
import { getUserEmail } from "@/lib/slack-api";
import {
  listAgentsForSlackApp,
  recordSlackDelivery,
  type SlackApp,
} from "@/lib/slack-apps";
import { getAgentByName } from "@/lib/workspace-agents";
import { listWorkspaceMembers } from "@/lib/workspace";

// The explicit-routing dispatcher: turn a Slack message into a TAS run.
// "Explicit" = the agent is named (slash `/tas <agent> <input>`, or the
// picker modal's submission). Natural-language routing is Step 5.

/** Split "<agent> <input…>" — first whitespace-delimited token is the agent. */
export function parseCommand(text: string): {
  agentName: string;
  input: string;
} {
  const trimmed = text.trim();
  if (!trimmed) return { agentName: "", input: "" };
  const m = trimmed.match(/^(\S+)\s*([\s\S]*)$/);
  if (!m) return { agentName: "", input: "" };
  return { agentName: m[1], input: m[2].trim() };
}

// The callback_id the interactivity route matches to dispatch a picker
// submission. private_metadata carries the originating channel/thread so
// the run's reply lands where the command was invoked.
export const PICKER_CALLBACK_ID = "tas_agent_picker";

/**
 * A modal listing the app's scoped agents (static_select) + a free-text
 * input. Opened when a slash command / mention names no (or an unknown)
 * agent. `scoped` must be non-empty.
 */
export function buildPickerView(
  scoped: { name: string; description?: string }[],
  privateMetadata: { channel: string; threadTs: string | null },
): Record<string, unknown> {
  return {
    type: "modal",
    callback_id: PICKER_CALLBACK_ID,
    private_metadata: JSON.stringify(privateMetadata),
    title: { type: "plain_text", text: "Launch an agent" },
    submit: { type: "plain_text", text: "Run" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "agent",
        label: { type: "plain_text", text: "Agent" },
        element: {
          type: "static_select",
          action_id: "agent",
          placeholder: { type: "plain_text", text: "Pick an agent" },
          options: scoped.slice(0, 100).map((a) => ({
            text: {
              type: "plain_text",
              text: a.name.slice(0, 75),
            },
            value: a.name,
          })),
        },
      },
      {
        type: "input",
        block_id: "input",
        optional: true,
        label: { type: "plain_text", text: "Input" },
        element: {
          type: "plain_text_input",
          action_id: "input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What should it do?",
          },
        },
      },
    ],
  };
}

export type DispatchResult =
  | {
      ok: true;
      runId: string;
      agentName: string;
      /** Human label for who the run acts as, for the ack message. */
      actingAs: string;
    }
  | { ok: false; reason: "no-agent" | "unknown-agent" | "agent-invalid" | "error"; message: string };

/**
 * Resolve the Slack user to a TAS member by verified email, falling back
 * to the app's default owner. Returns the user id to run as plus a label.
 */
async function resolveActingUser(
  app: SlackApp,
  botToken: string,
  slackUserId: string,
): Promise<{ userId: string; label: string }> {
  const email = await getUserEmail(botToken, slackUserId);
  if (email) {
    const members = await listWorkspaceMembers(app.workspaceId);
    const match = members.find(
      (m) => m.email.toLowerCase() === email.toLowerCase(),
    );
    if (match) {
      return { userId: match.userId, label: match.name ?? match.email };
    }
  }
  return { userId: app.defaultOwnerUserId, label: "the app's default owner" };
}

/**
 * Dispatch an explicit `<agent> <input>` to a run. Validates the agent is
 * in the app's label scope, resolves the acting user, enqueues the run
 * (trigger=event), and records where to post the result.
 */
export async function dispatchToAgent(args: {
  app: SlackApp;
  botToken: string;
  slackUserId: string;
  text: string;
  channel: string;
  threadTs: string | null;
}): Promise<DispatchResult> {
  const { app, botToken, slackUserId, text, channel, threadTs } = args;
  const { agentName, input } = parseCommand(text);
  if (!agentName) {
    return { ok: false, reason: "no-agent", message: "No agent named." };
  }

  // Scope gate: only agents whose labels intersect this app's labels.
  const scoped = await listAgentsForSlackApp(app);
  const inScope = scoped.find((a) => a.name === agentName);
  if (!inScope) {
    return {
      ok: false,
      reason: "unknown-agent",
      message: `"${agentName}" isn't an agent this bot can launch.`,
    };
  }

  const resolved = await getAgentByName(app.workspaceId, agentName);
  if (!resolved || !resolved.agent.ok) {
    return {
      ok: false,
      reason: "agent-invalid",
      message: `"${agentName}" couldn't be loaded from the repo.`,
    };
  }
  const spec = resolved.agent.spec;
  const model = spec.model ?? "";
  const format = detectFormat(resolved.agent.path);
  if (!model || !format) {
    return {
      ok: false,
      reason: "agent-invalid",
      message: `"${agentName}" is missing a model or has an unrecognized file type.`,
    };
  }

  const acting = await resolveActingUser(app, botToken, slackUserId);

  try {
    const { runId } = await createRun({
      workspaceId: app.workspaceId,
      userId: acting.userId,
      agentName: spec.name,
      agentPath: resolved.agent.path,
      model,
      userMessage: input,
      framework: spec.framework,
      specContent: resolved.raw,
      specFormat: format,
      trigger: "event",
    });
    await recordSlackDelivery({
      runId,
      slackAppId: app.id,
      channel,
      threadTs,
    });
    return { ok: true, runId, agentName: spec.name, actingAs: acting.label };
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      message: e instanceof Error ? e.message : "Failed to start the run.",
    };
  }
}
