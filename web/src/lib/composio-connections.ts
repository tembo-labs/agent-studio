import "server-only";

import { db } from "@/lib/db";
import { type ComposioToolkit } from "@/lib/composio";

// DB layer for the workspace_composio_connection table — the local
// cache of "this user has connected toolkit X via Composio".
// The actual credentials live in Composio's vault; we just store
// the id we use to look them up plus enough metadata to render the
// Settings list without round-tripping Composio on every page load.
//
// Per migration 0022: rows are scoped per-user, not per-workspace.
// Each (workspace_id, user_id, toolkit_slug, name) is unique — a
// user can hold multiple Gmails ("work", "personal"), and other
// workspace members hold their own separate connections.

export const DEFAULT_CONNECTION_NAME = "default";

export type WorkspaceComposioConnection = {
  id: string;
  workspaceId: string;
  userId: string;
  toolkit: ComposioToolkit;
  name: string;
  composioConnectionId: string;
  authConfigId: string;
  status: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type Row = {
  id: string;
  workspace_id: string;
  user_id: string;
  toolkit_slug: ComposioToolkit;
  name: string;
  composio_connection_id: string;
  auth_config_id: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS =
  "id, workspace_id, user_id, toolkit_slug, name, composio_connection_id, auth_config_id, status, metadata, created_by, created_at, updated_at";

function rowToConnection(r: Row): WorkspaceComposioConnection {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
    toolkit: r.toolkit_slug,
    name: r.name,
    composioConnectionId: r.composio_connection_id,
    authConfigId: r.auth_config_id,
    status: r.status,
    metadata: r.metadata ?? {},
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * List the connections a specific user holds in a workspace. This is
 * what the Settings page renders ("Your connections") and the
 * sidebar uses to compute missing-connection alerts for the current
 * user.
 */
export async function listConnectionsForUser(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceComposioConnection[]> {
  const { rows } = await db.query<Row>(
    `SELECT ${COLUMNS}
       FROM workspace_composio_connection
      WHERE workspace_id = $1 AND user_id = $2
      ORDER BY toolkit_slug ASC, name ASC`,
    [workspaceId, userId],
  );
  return rows.map(rowToConnection);
}

/** Every ACTIVE Composio connection across all workspaces/users — for the
 *  deploy/scheduled tool-cache reconcile (not a per-user view). */
export async function listAllActiveComposioConnections(): Promise<
  WorkspaceComposioConnection[]
> {
  const { rows } = await db.query<Row>(
    `SELECT ${COLUMNS}
       FROM workspace_composio_connection
      WHERE status = 'ACTIVE'
      ORDER BY workspace_id ASC, user_id ASC, toolkit_slug ASC, name ASC`,
  );
  return rows.map(rowToConnection);
}

/**
 * Lookup a specific (user, toolkit, name) tuple. Used by the
 * runner to resolve which Composio connection an agent's declared
 * connection points at.
 */
export async function getComposioConnection(
  workspaceId: string,
  userId: string,
  toolkit: ComposioToolkit,
  name: string,
): Promise<WorkspaceComposioConnection | null> {
  const { rows } = await db.query<Row>(
    `SELECT ${COLUMNS}
       FROM workspace_composio_connection
      WHERE workspace_id = $1 AND user_id = $2 AND toolkit_slug = $3 AND name = $4
      LIMIT 1`,
    [workspaceId, userId, toolkit, name],
  );
  return rows[0] ? rowToConnection(rows[0]) : null;
}

export async function getComposioConnectionById(
  workspaceId: string,
  id: string,
): Promise<WorkspaceComposioConnection | null> {
  const { rows } = await db.query<Row>(
    `SELECT ${COLUMNS}
       FROM workspace_composio_connection
      WHERE workspace_id = $1 AND id = $2
      LIMIT 1`,
    [workspaceId, id],
  );
  return rows[0] ? rowToConnection(rows[0]) : null;
}

/**
 * Upsert by (workspace_id, user_id, toolkit_slug, name). Reconnect
 * for the same named slot replaces the previous Composio
 * connection_id in place.
 */
export async function saveComposioConnection(args: {
  workspaceId: string;
  userId: string;
  toolkit: ComposioToolkit;
  name: string;
  composioConnectionId: string;
  authConfigId: string;
  status: string;
  metadata: Record<string, unknown>;
}): Promise<WorkspaceComposioConnection> {
  const { rows } = await db.query<Row>(
    `INSERT INTO workspace_composio_connection
       (workspace_id, user_id, toolkit_slug, name, composio_connection_id, auth_config_id, status, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $2)
       ON CONFLICT (workspace_id, user_id, toolkit_slug, name)
       DO UPDATE SET composio_connection_id = EXCLUDED.composio_connection_id,
                     auth_config_id         = EXCLUDED.auth_config_id,
                     status                 = EXCLUDED.status,
                     metadata               = EXCLUDED.metadata,
                     updated_at             = NOW()
       RETURNING ${COLUMNS}`,
    [
      args.workspaceId,
      args.userId,
      args.toolkit,
      args.name,
      args.composioConnectionId,
      args.authConfigId,
      args.status,
      JSON.stringify(args.metadata),
    ],
  );
  return rowToConnection(rows[0]);
}

export type RenameComposioConnectionError =
  | "bad-name-shape"
  | "name-taken"
  | "not-found";

export type RenameComposioConnectionResult =
  | { ok: true }
  | { ok: false; error: RenameComposioConnectionError };

/**
 * Rename the slot identifier on an existing connection. Returns
 * `name-taken` when the user already holds another connection with
 * the same (toolkit, new-name) tuple, `bad-name-shape` when the
 * name fails the slug regex, `not-found` when the row id doesn't
 * belong to the workspace. Composio's side isn't touched — the
 * connected_account_id is the durable identifier; `name` is purely
 * a TAS-local label.
 *
 * Caller is responsible for surfacing the side effect: any agent
 * file referencing the old name will fail at run time until its
 * `connections:` field is updated.
 */
export async function renameComposioConnection(
  workspaceId: string,
  connectionId: string,
  newName: string,
): Promise<RenameComposioConnectionResult> {
  const normalized = newName.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    return { ok: false, error: "bad-name-shape" };
  }
  // Look up the existing row so we know its toolkit + user and can
  // do the uniqueness check before attempting the UPDATE (postgres
  // would return a 23505 on conflict, but a pre-check yields a
  // nicer error code).
  const existing = await getComposioConnectionById(workspaceId, connectionId);
  if (!existing) return { ok: false, error: "not-found" };
  if (existing.name === normalized) return { ok: true }; // no-op rename
  const { rowCount: collision } = await db.query(
    `SELECT 1 FROM workspace_composio_connection
       WHERE workspace_id = $1 AND user_id = $2
         AND toolkit_slug = $3 AND name = $4 AND id <> $5
       LIMIT 1`,
    [workspaceId, existing.userId, existing.toolkit, normalized, connectionId],
  );
  if ((collision ?? 0) > 0) {
    return { ok: false, error: "name-taken" };
  }
  await db.query(
    `UPDATE workspace_composio_connection
        SET name = $2, updated_at = NOW()
      WHERE id = $1`,
    [connectionId, normalized],
  );
  return { ok: true };
}

export async function deleteComposioConnection(
  workspaceId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM workspace_composio_connection WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId],
  );
  return (rowCount ?? 0) > 0;
}
