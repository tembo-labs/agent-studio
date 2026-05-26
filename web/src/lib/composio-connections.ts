import "server-only";

import { db } from "@/lib/db";
import { type ComposioToolkit } from "@/lib/composio";

// DB layer for the workspace_composio_connection table — the local
// cache of "this workspace has connected toolkit X via Composio".
// The actual credentials live in Composio's vault; we just store
// the id we use to look them up plus enough metadata to render the
// Settings list without round-tripping Composio on every page load.

export type WorkspaceComposioConnection = {
  id: string;
  workspaceId: string;
  toolkit: ComposioToolkit;
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
  toolkit_slug: ComposioToolkit;
  composio_connection_id: string;
  auth_config_id: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS =
  "id, workspace_id, toolkit_slug, composio_connection_id, auth_config_id, status, metadata, created_by, created_at, updated_at";

function rowToConnection(r: Row): WorkspaceComposioConnection {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    toolkit: r.toolkit_slug,
    composioConnectionId: r.composio_connection_id,
    authConfigId: r.auth_config_id,
    status: r.status,
    metadata: r.metadata ?? {},
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listComposioConnectionsForWorkspace(
  workspaceId: string,
): Promise<WorkspaceComposioConnection[]> {
  const { rows } = await db.query<Row>(
    `SELECT ${COLUMNS}
       FROM workspace_composio_connection
      WHERE workspace_id = $1
      ORDER BY toolkit_slug ASC`,
    [workspaceId],
  );
  return rows.map(rowToConnection);
}

export async function getComposioConnectionByToolkit(
  workspaceId: string,
  toolkit: ComposioToolkit,
): Promise<WorkspaceComposioConnection | null> {
  const { rows } = await db.query<Row>(
    `SELECT ${COLUMNS}
       FROM workspace_composio_connection
      WHERE workspace_id = $1 AND toolkit_slug = $2
      LIMIT 1`,
    [workspaceId, toolkit],
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
 * Upsert by (workspace_id, toolkit_slug) — the reconnect path naturally
 * overwrites the previous Composio connection id with the new one.
 */
export async function saveComposioConnection(args: {
  workspaceId: string;
  toolkit: ComposioToolkit;
  composioConnectionId: string;
  authConfigId: string;
  status: string;
  metadata: Record<string, unknown>;
  userId: string;
}): Promise<WorkspaceComposioConnection> {
  const { rows } = await db.query<Row>(
    `INSERT INTO workspace_composio_connection
       (workspace_id, toolkit_slug, composio_connection_id, auth_config_id, status, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (workspace_id, toolkit_slug)
       DO UPDATE SET composio_connection_id = EXCLUDED.composio_connection_id,
                     auth_config_id         = EXCLUDED.auth_config_id,
                     status                 = EXCLUDED.status,
                     metadata               = EXCLUDED.metadata,
                     updated_at             = NOW()
       RETURNING ${COLUMNS}`,
    [
      args.workspaceId,
      args.toolkit,
      args.composioConnectionId,
      args.authConfigId,
      args.status,
      JSON.stringify(args.metadata),
      args.userId,
    ],
  );
  return rowToConnection(rows[0]);
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
