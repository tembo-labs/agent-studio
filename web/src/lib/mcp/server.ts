import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AuthorizeApiSuccess } from "@/lib/api-auth";
import {
  createAutomationFor,
  createSlackAppFor,
  deleteSlackAppFor,
  requestAgentChange,
  sendSlackMessageFor,
  triggerRun,
  updateSlackAppFor,
  validateSpec,
} from "@/lib/api-v1/actions";
import {
  serializeAgent,
  serializeAutomation,
  serializeConnections,
  serializeRunListItem,
  serializeRunRecord,
  serializeSlackApp,
  serializeTool,
} from "@/lib/api-v1/serializers";
import { FRAMEWORKS, type Framework } from "@/lib/agent-framework";
import { listAutomations } from "@/lib/automations-api";
import { listConnectionsForUser } from "@/lib/composio-connections";
import { listNativeConnectionsForUser } from "@/lib/connections";
import { listToolsForUser } from "@/lib/mcp-tools";
import { meetsMinRole } from "@/lib/rbac";
import { getRun } from "@/lib/runs-api";
import { listRunsForWorkspace, type RunListFilters } from "@/lib/runs-db";
import { listSlackApps } from "@/lib/slack-apps";
import { getAgentByName, listAgents } from "@/lib/workspace-agents";

// The MCP server exposed at /mcp. It mirrors the /api/v1 REST surface as MCP
// tools so a client like Claude Code can read a TAS deployment's live state and
// drive it. Stateless: a fresh McpServer is built per request and closes over
// the resolved auth context (which workspace, which acting user, what role) so
// every tool is already scoped — no tool takes a workspace/user argument.
//
// Read tools require viewer (the key already cleared that in authorizeApiRequest);
// write tools (added in P4) re-check operator via ctx.role.

export type McpContext = AuthorizeApiSuccess;

/** Wrap any JSON-serializable payload as an MCP text result. */
function json(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

/** An error result the model can read and react to (vs. throwing). */
function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const FRAMEWORK_VALUES = FRAMEWORKS as readonly [Framework, ...Framework[]];

export function buildMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer({
    name: "tembo-agent-studio",
    version: "1.0.0",
  });

  server.registerTool(
    "list_agents",
    {
      description:
        "List every agent in this workspace's connected repo, including specs " +
        "that fail to parse (so you can see and fix them). Returns each agent's " +
        "name, file path, framework, validity, and parsed spec.",
    },
    async () => {
      const result = await listAgents(ctx.workspace.id);
      if (!result.ok) {
        return errorResult(
          result.error === "no-repo"
            ? "No repository is connected to this workspace."
            : `Could not read agents: ${result.error}${result.detail ? ` (${result.detail})` : ""}`,
        );
      }
      return json({ agents: result.agents.map(serializeAgent) });
    },
  );

  server.registerTool(
    "get_agent",
    {
      description:
        "Get one agent by its declared name, including the raw on-disk spec " +
        "text and any sidecar tools-module / skills content. Use this to read " +
        "exactly what's deployed before proposing an edit.",
      inputSchema: { name: z.string().describe("The agent's declared name (matches its filename).") },
    },
    async ({ name }) => {
      const found = await getAgentByName(ctx.workspace.id, name);
      if (!found) return errorResult(`No agent named "${name}" in this workspace.`);
      return json({
        agent: serializeAgent(found.agent),
        raw: found.raw,
        toolsModuleContent: found.toolsModuleContent ?? null,
        skillsContent: found.skillsContent ?? null,
      });
    },
  );

  server.registerTool(
    "list_runs",
    {
      description:
        "List recent agent runs for this workspace, newest first. Filter by " +
        "status, agent name, and/or trigger. Returns compact rows (status, " +
        "cost, previews) — call get_run for full output.",
      inputSchema: {
        status: z
          .enum(["queued", "running", "succeeded", "failed"])
          .array()
          .optional()
          .describe("Only runs in these statuses."),
        agent: z.string().optional().describe("Only runs of this agent."),
        trigger: z
          .enum(["manual", "schedule", "event"])
          .array()
          .optional()
          .describe("Only runs from these triggers."),
        limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 50)."),
      },
    },
    async ({ status, agent, trigger, limit }) => {
      const filters: RunListFilters = {
        ...(status?.length ? { statuses: status } : {}),
        ...(trigger?.length ? { triggers: trigger } : {}),
        ...(agent ? { agentName: agent } : {}),
      };
      const runs = await listRunsForWorkspace(ctx.workspace.id, filters, {
        ...(limit ? { limit } : {}),
      });
      return json({ runs: runs.map(serializeRunListItem) });
    },
  );

  server.registerTool(
    "get_run",
    {
      description:
        "Get one run by id with its full output, live streamed output, error " +
        "message, and token usage. Use after trigger_run, or to inspect why a " +
        "run failed.",
      inputSchema: { id: z.string().describe("The run id.") },
    },
    async ({ id }) => {
      let run;
      try {
        run = await getRun(id, ctx.workspace.id);
      } catch {
        return errorResult("Could not reach the run service.");
      }
      if (!run) return errorResult(`No run with id "${id}" in this workspace.`);
      return json({ run: serializeRunRecord(run) });
    },
  );

  server.registerTool(
    "list_tools",
    {
      description:
        "List the cached tool catalog for this API key's user (composio + " +
        "native-mcp). Each tool's `slug` is what goes into an agent's " +
        "`connections: tools: [...]` — use this when authoring connections.",
    },
    async () => {
      const tools = await listToolsForUser(ctx.workspace.id, ctx.userId);
      return json({ tools: tools.map(serializeTool) });
    },
  );

  server.registerTool(
    "list_connections",
    {
      description:
        "List this API key user's per-user connection status (composio + " +
        "native-mcp): provider, slot name, and whether it's active. Use to " +
        "check an agent's declared connections are authorized before a run. " +
        "No tokens are returned.",
    },
    async () => {
      const [composio, nativeMcp] = await Promise.all([
        listConnectionsForUser(ctx.workspace.id, ctx.userId),
        listNativeConnectionsForUser(ctx.workspace.id, ctx.userId),
      ]);
      return json({ connections: serializeConnections(composio, nativeMcp) });
    },
  );

  server.registerTool(
    "list_automations",
    {
      description: "List the workspace's scheduled automations (cron-triggered agent runs).",
    },
    async () => {
      const automations = await listAutomations(ctx.workspace.id);
      return json({ automations: automations.map(serializeAutomation) });
    },
  );

  server.registerTool(
    "list_slack_apps",
    {
      description: "List the workspace's Slack bots (secret-safe — no tokens).",
    },
    async () => {
      const apps = await listSlackApps(ctx.workspace.id);
      return json({ slackApps: apps.map(serializeSlackApp) });
    },
  );

  // ── Write tools (operator) ──────────────────────────────────────────
  // Connecting only required viewer; these re-check operator on the resolved
  // role so a viewer key can read but not act.
  const isOperator = meetsMinRole(ctx.role, "operator");
  const operatorOnly = () =>
    errorResult(
      "This action requires the operator role; this API key's user is a viewer.",
    );
  const isAdmin = meetsMinRole(ctx.role, "workspace_admin");
  const adminOnly = () =>
    errorResult(
      "This action requires the workspace_admin role.",
    );

  server.registerTool(
    "validate_agent_spec",
    {
      description:
        "Parse an agent spec WITHOUT writing it to the repo — use this to check " +
        "a draft before committing. Provide `format` (yaml|json) or a `filename` " +
        "to infer it. Returns validity plus the detected framework and name.",
      inputSchema: {
        content: z.string().describe("The full spec text."),
        format: z.enum(["yaml", "json"]).optional(),
        filename: z.string().optional().describe("Used to infer format if not given."),
      },
    },
    async ({ content, format, filename }) => {
      const out = validateSpec({ content, format, filename });
      if (!out.ok) return errorResult(out.error);
      return json(out.result);
    },
  );

  server.registerTool(
    "trigger_run",
    {
      description:
        "Run an agent now, acting as this API key's user (so the run uses that " +
        "user's connections). Returns the run id — poll get_run for output. " +
        "Runs the stable version by default; set preferDraft to run the live file.",
      inputSchema: {
        agent: z.string().describe("The agent's declared name."),
        message: z.string().optional().describe("Optional user input for the run."),
        preferDraft: z.boolean().optional().describe("Run the live draft instead of stable."),
      },
    },
    async ({ agent, message, preferDraft }) => {
      if (!isOperator) return operatorOnly();
      const res = await triggerRun(ctx, { agent, message, preferDraft });
      if (!res.ok) return errorResult(res.error);
      return json({ runId: res.runId });
    },
  );

  server.registerTool(
    "create_automation",
    {
      description:
        "Schedule an agent to run on a cron expression. The scheduled run acts " +
        "as this API key's user. Returns the created automation.",
      inputSchema: {
        name: z.string().describe("Human label for the automation."),
        agent: z.string().describe("The agent to run."),
        cron: z.string().describe("Cron expression, e.g. '0 9 * * 1' (Mon 9am)."),
        inputMessage: z.string().optional().describe("Optional input passed to each run."),
        enabled: z.boolean().optional().describe("Start enabled (default true)."),
        useDraft: z.boolean().optional().describe("Run the live draft instead of stable."),
      },
    },
    async ({ name, agent, cron, inputMessage, enabled, useDraft }) => {
      if (!isOperator) return operatorOnly();
      const res = await createAutomationFor(ctx, {
        name,
        agent,
        cron,
        inputMessage,
        enabled,
        useDraft,
      });
      if (!res.ok) return errorResult(res.error);
      return json({ automation: serializeAutomation(res.automation) });
    },
  );

  server.registerTool(
    "request_agent_change",
    {
      description:
        "Hand an authoring request to the Tembo Coding Agent, which opens a PR " +
        "(or commits directly, per workspace settings). To EDIT an existing " +
        "agent pass `agent` + `description`; to CREATE one pass `name` + " +
        "`description` (+ optional framework). Returns the Tembo task URL. " +
        "Tip: if you can edit the repo files directly, that's usually faster " +
        "than this — use this when you want TAS to drive the change.",
      inputSchema: {
        description: z.string().describe("What to change, or what the new agent should do."),
        agent: z.string().optional().describe("Existing agent to edit (omit to create)."),
        name: z.string().optional().describe("Display name for a NEW agent."),
        framework: z.enum(FRAMEWORK_VALUES).optional().describe("New-agent framework (default pydantic-agentspec)."),
      },
    },
    async ({ description, agent, name, framework }) => {
      if (!isOperator) return operatorOnly();
      const res = await requestAgentChange(ctx, { description, agent, name, framework });
      if (!res.ok) return errorResult(res.error);
      return json(res.result);
    },
  );

  server.registerTool(
    "send_slack_message",
    {
      description:
        "Send a Slack message from one of this workspace's Slack apps — the way " +
        "to actually notify a person. DM someone by `toEmail` (they get a real " +
        "DM + notification), or post to a channel by `channel` (Slack id). This " +
        "is NOT the Composio Slack tool, whose 'DM' posts to the bot's own " +
        "account where nobody sees it. Provide exactly one of toEmail / channel.",
      inputSchema: {
        text: z.string().describe("The message text (Slack mrkdwn)."),
        toEmail: z
          .string()
          .optional()
          .describe("DM this person by email (resolved to their Slack user)."),
        channel: z
          .string()
          .optional()
          .describe("Or post to this Slack channel/user id (e.g. C0123, U0123)."),
        slackApp: z
          .string()
          .optional()
          .describe("Which Slack app to send from (by name); optional if one."),
        threadTs: z.string().optional().describe("Reply under this thread ts."),
      },
    },
    async ({ text, toEmail, channel, slackApp, threadTs }) => {
      if (!isOperator) return operatorOnly();
      const res = await sendSlackMessageFor(ctx, {
        text,
        toEmail,
        channel,
        slackApp,
        threadTs,
      });
      if (!res.ok) return errorResult(res.error);
      return json({ sent: true, channel: res.channel, ts: res.ts });
    },
  );

  // ── Slack-app management (workspace_admin) ──────────────────────────
  server.registerTool(
    "create_slack_app",
    {
      description:
        "Create a Slack bot for this workspace (admin only). This creates the " +
        "app in a `configuring` state with metadata only — finish setup with " +
        "the one-time browser OAuth install under Settings -> Slack apps before " +
        "it can run. `agentLabels` are the agent labels this bot may launch.",
      inputSchema: {
        name: z.string().describe("Display name (<=35 chars, Slack's limit)."),
        agentLabels: z.string().array().optional().describe("Agent labels this bot may launch."),
        defaultOwnerUserId: z.string().optional().describe("Member whose credentials its runs use (defaults to you)."),
        slackAppId: z.string().optional(),
        signingSecret: z.string().optional(),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      },
    },
    async ({ name, agentLabels, defaultOwnerUserId, slackAppId, signingSecret, clientId, clientSecret }) => {
      if (!isAdmin) return adminOnly();
      const res = await createSlackAppFor(ctx, {
        name,
        agentLabels,
        defaultOwnerUserId,
        slackAppId,
        signingSecret,
        clientId,
        clientSecret,
      });
      if (!res.ok) return errorResult(res.error);
      return json({ slackApp: serializeSlackApp(res.slackApp) });
    },
  );

  server.registerTool(
    "update_slack_app",
    {
      description:
        "Update a Slack bot (admin only): name, the agent labels it may launch, " +
        "default owner, Slack app id, or secrets. Omitted fields are left " +
        "unchanged; secrets are only written when a non-empty value is given.",
      inputSchema: {
        id: z.string().describe("The Slack app's id."),
        name: z.string().optional(),
        agentLabels: z.string().array().optional(),
        defaultOwnerUserId: z.string().optional(),
        slackAppId: z.string().optional(),
        signingSecret: z.string().optional(),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      },
    },
    async ({ id, name, agentLabels, defaultOwnerUserId, slackAppId, signingSecret, clientId, clientSecret }) => {
      if (!isAdmin) return adminOnly();
      const res = await updateSlackAppFor(ctx, id, {
        name,
        agentLabels,
        defaultOwnerUserId,
        slackAppId,
        signingSecret,
        clientId,
        clientSecret,
      });
      if (!res.ok) return errorResult(res.error);
      return json({ slackApp: serializeSlackApp(res.slackApp) });
    },
  );

  server.registerTool(
    "delete_slack_app",
    {
      description: "Delete a Slack bot from this workspace (admin only).",
      inputSchema: { id: z.string().describe("The Slack app's id.") },
    },
    async ({ id }) => {
      if (!isAdmin) return adminOnly();
      const res = await deleteSlackAppFor(ctx, id);
      if (!res.ok) return errorResult(res.error);
      return json({ deleted: true, id });
    },
  );

  return server;
}
