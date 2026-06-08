import "server-only";

import { db } from "@/lib/db";

// Normalized tool catalog (workspace_mcp_tool). Each row is one tool
// exposed by one connection. Replaces the JSONB cached_tools blob
// that lived on workspace_connection so we get:
//
//   - symmetric storage for Composio + native MCP (both refresh
//     through the same path)
//   - cheap "every tool this user has" queries for the Tools page
//   - a sensible place to add per-tool metadata later (input schema,
//     enabled flag, last-used timestamp)
//
// Writes happen at two points: on connect (callback primes the row's
// catalog) and on the Refresh action. Reads happen on the
// Connections rows (count + expand) and the Tools page.

export type McpToolSource = "composio" | "native-mcp";

export type McpTool = {
  id: string;
  workspaceId: string;
  userId: string;
  source: McpToolSource;
  provider: string;
  connectionName: string;
  slug: string;
  displayName: string | null;
  description: string | null;
  refreshedAt: Date;
  createdAt: Date;
};

type Row = {
  id: string;
  workspace_id: string;
  user_id: string;
  source: string;
  provider: string;
  connection_name: string;
  slug: string;
  display_name: string | null;
  description: string | null;
  refreshed_at: Date;
  created_at: Date;
};

function rowToTool(r: Row): McpTool {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
    source: r.source as McpToolSource,
    provider: r.provider,
    connectionName: r.connection_name,
    slug: r.slug,
    displayName: r.display_name,
    description: r.description,
    refreshedAt: r.refreshed_at,
    createdAt: r.created_at,
  };
}

const COLUMNS = `id, workspace_id, user_id, source, provider,
  connection_name, slug, display_name, description, refreshed_at, created_at`;

/**
 * Every tool the user has across both substrates, in one query.
 * Powers the workspace Tools tab. Sort key chosen so the page
 * groups naturally: source first (composio above native), then
 * provider alphabetical, then connection name, then tool slug.
 */
export async function listToolsForUser(
  workspaceId: string,
  userId: string,
): Promise<McpTool[]> {
  const { rows } = await db.query<Row>(
    `SELECT ${COLUMNS}
       FROM workspace_mcp_tool
      WHERE workspace_id = $1 AND user_id = $2
      ORDER BY source ASC, provider ASC, connection_name ASC, slug ASC`,
    [workspaceId, userId],
  );
  return rows.map(rowToTool);
}

/**
 * Distinct tool-slug → (source, provider) across the whole workspace's tool
 * cache, for resolving a run's recorded tool_name to the provider whose logo
 * to show. Workspace-wide (not per-user) because a tool slug maps to the same
 * provider regardless of who connected it; this also covers runs whose acting
 * user differs from the viewer. Slug collisions across providers are rare; the
 * caller takes the first.
 */
export async function listWorkspaceToolProviders(
  workspaceId: string,
): Promise<{ slug: string; source: McpToolSource; provider: string }[]> {
  const { rows } = await db.query<{
    slug: string;
    source: string;
    provider: string;
  }>(
    `SELECT DISTINCT slug, source, provider
       FROM workspace_mcp_tool
      WHERE workspace_id = $1`,
    [workspaceId],
  );
  return rows.map((r) => ({
    slug: r.slug,
    source: r.source as McpToolSource,
    provider: r.provider,
  }));
}

/**
 * Tools for one specific connection slot. Used by the per-row
 * expand affordance on Connections so each row can render its own
 * count + list without scanning the full per-user set in JS.
 */
export async function listToolsForConnection(
  workspaceId: string,
  userId: string,
  source: McpToolSource,
  provider: string,
  connectionName: string,
): Promise<McpTool[]> {
  const { rows } = await db.query<Row>(
    `SELECT ${COLUMNS}
       FROM workspace_mcp_tool
      WHERE workspace_id = $1 AND user_id = $2
        AND source = $3 AND provider = $4 AND connection_name = $5
      ORDER BY slug ASC`,
    [workspaceId, userId, source, provider, connectionName],
  );
  return rows.map(rowToTool);
}

export type NewTool = {
  slug: string;
  displayName?: string | null;
  description?: string | null;
};

/**
 * Authoritative replace: drop every cached tool for the connection
 * slot, then insert the freshly-fetched list. Uses a connection-
 * scoped BEGIN/COMMIT so the Tools page never reads a half-applied
 * catalog. Returns the count inserted so the caller can show
 * "N tools cached".
 */
export async function replaceToolsForConnection(args: {
  workspaceId: string;
  userId: string;
  source: McpToolSource;
  provider: string;
  connectionName: string;
  tools: NewTool[];
}): Promise<number> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM workspace_mcp_tool
        WHERE workspace_id = $1 AND user_id = $2
          AND source = $3 AND provider = $4 AND connection_name = $5`,
      [
        args.workspaceId,
        args.userId,
        args.source,
        args.provider,
        args.connectionName,
      ],
    );
    if (args.tools.length > 0) {
      // Multi-row INSERT in one statement so the round trip cost
      // stays bounded even if a provider exposes a few hundred
      // tools. ON CONFLICT is paranoia — the preceding DELETE
      // should leave the slot empty, but a parallel refresh would
      // otherwise race.
      const values: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      for (const t of args.tools) {
        values.push(
          `($${i}, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7})`,
        );
        params.push(
          args.workspaceId,
          args.userId,
          args.source,
          args.provider,
          args.connectionName,
          t.slug,
          t.displayName ?? null,
          t.description ?? null,
        );
        i += 8;
      }
      await client.query(
        `INSERT INTO workspace_mcp_tool
           (workspace_id, user_id, source, provider, connection_name,
            slug, display_name, description)
           VALUES ${values.join(", ")}
         ON CONFLICT (workspace_id, user_id, source, provider, connection_name, slug)
         DO UPDATE SET display_name = EXCLUDED.display_name,
                       description  = EXCLUDED.description,
                       refreshed_at = NOW()`,
        params,
      );
    }
    await client.query("COMMIT");
    return args.tools.length;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Drop every cached tool for the connection slot. Called from the
 * disconnect actions so a re-Connect under the same name doesn't
 * inherit a stale catalog from a prior auth.
 */
export async function deleteToolsForConnection(args: {
  workspaceId: string;
  userId: string;
  source: McpToolSource;
  provider: string;
  connectionName: string;
}): Promise<void> {
  await db.query(
    `DELETE FROM workspace_mcp_tool
      WHERE workspace_id = $1 AND user_id = $2
        AND source = $3 AND provider = $4 AND connection_name = $5`,
    [
      args.workspaceId,
      args.userId,
      args.source,
      args.provider,
      args.connectionName,
    ],
  );
}

/**
 * Move cached tools from one connection name to another. Called
 * from the rename actions so the (source, provider, name) tuple in
 * workspace_mcp_tool stays in sync with the connection row.
 *
 * Safe to call on a no-op rename (oldName === newName); the WHERE
 * matches nothing because we shifted to the new name first.
 */
export async function renameToolsForConnection(args: {
  workspaceId: string;
  userId: string;
  source: McpToolSource;
  provider: string;
  oldName: string;
  newName: string;
}): Promise<void> {
  if (args.oldName === args.newName) return;
  await db.query(
    `UPDATE workspace_mcp_tool
        SET connection_name = $6
      WHERE workspace_id = $1 AND user_id = $2
        AND source = $3 AND provider = $4 AND connection_name = $5`,
    [
      args.workspaceId,
      args.userId,
      args.source,
      args.provider,
      args.oldName,
      args.newName,
    ],
  );
}
