import "server-only";

import { toolkitLabel } from "@/lib/composio";
import { db } from "@/lib/db";
import { getMcpProvider } from "@/lib/mcp-providers";

// Per-member activity for the workspace dashboard's Team table:
// connection count (active Composio + Native MCP), automations the
// member owns ("Run as"), and runs they triggered in the last 30 days.
// Also returns the connection labels and automation agent names so the
// dashboard can show them on hover. Aggregated server-side so it's a
// handful of queries, not N-per-member.

export type MemberActivity = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  connections: number;
  /** Labels of each active connection, e.g. "Slack", "Gmail (work)". */
  connectionLabels: string[];
  automations: number;
  /** Distinct agent names this member owns automations for. */
  automationAgents: string[];
  runs30d: number;
};

function slotLabel(label: string, name: string): string {
  return name && name !== "default" ? `${label} (${name})` : label;
}

export async function listMemberActivity(
  workspaceId: string,
): Promise<MemberActivity[]> {
  const [members, composio, native, autos, runs] = await Promise.all([
    db.query<{
      user_id: string;
      name: string | null;
      email: string;
      role: string;
    }>(
      `SELECT m.user_id, u.name, u.email, m.role
         FROM workspace_member m
         JOIN "user" u ON u.id = m.user_id
        WHERE m.workspace_id = $1
        ORDER BY COALESCE(u.name, u.email) ASC`,
      [workspaceId],
    ),
    db.query<{ user_id: string; toolkit_slug: string; name: string }>(
      `SELECT user_id, toolkit_slug, name FROM workspace_composio_connection
        WHERE workspace_id = $1 AND status = 'ACTIVE'`,
      [workspaceId],
    ),
    db.query<{ user_id: string; type: string; name: string }>(
      `SELECT user_id, type, name FROM workspace_connection
        WHERE workspace_id = $1 AND status = 'active'`,
      [workspaceId],
    ),
    db.query<{ user_id: string; agent_name: string }>(
      `SELECT owner_user_id AS user_id, agent_name FROM automation
        WHERE workspace_id = $1`,
      [workspaceId],
    ),
    db.query<{ user_id: string; n: string }>(
      `SELECT created_by AS user_id, COUNT(*) AS n FROM run
        WHERE workspace_id = $1 AND created_at >= now() - interval '30 days'
        GROUP BY created_by`,
      [workspaceId],
    ),
  ]);

  const connByUser = new Map<string, string[]>();
  for (const r of composio.rows) {
    const arr = connByUser.get(r.user_id) ?? [];
    arr.push(slotLabel(toolkitLabel(r.toolkit_slug), r.name));
    connByUser.set(r.user_id, arr);
  }
  for (const r of native.rows) {
    const arr = connByUser.get(r.user_id) ?? [];
    const label = getMcpProvider(r.type)?.displayName ?? r.type;
    arr.push(slotLabel(label, r.name));
    connByUser.set(r.user_id, arr);
  }

  // Per user: total automation rows + the distinct agents they target.
  const autoCount = new Map<string, number>();
  const autoAgents = new Map<string, Set<string>>();
  for (const r of autos.rows) {
    autoCount.set(r.user_id, (autoCount.get(r.user_id) ?? 0) + 1);
    const set = autoAgents.get(r.user_id) ?? new Set<string>();
    set.add(r.agent_name);
    autoAgents.set(r.user_id, set);
  }
  const runs30d = new Map(runs.rows.map((r) => [r.user_id, Number(r.n)]));

  return members.rows.map((m) => {
    const labels = (connByUser.get(m.user_id) ?? []).sort((a, b) =>
      a.localeCompare(b),
    );
    const agents = [...(autoAgents.get(m.user_id) ?? [])].sort((a, b) =>
      a.localeCompare(b),
    );
    return {
      userId: m.user_id,
      name: m.name,
      email: m.email,
      role: m.role,
      connections: labels.length,
      connectionLabels: labels,
      automations: autoCount.get(m.user_id) ?? 0,
      automationAgents: agents,
      runs30d: runs30d.get(m.user_id) ?? 0,
    };
  });
}
