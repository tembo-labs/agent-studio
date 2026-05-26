import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";

// Workspace connections — the TAS-side half of the substrate that lets
// an agent's Python tools reach external services at run time. A row
// is identified by (workspace_id, type, name); the agent's AgentSpec
// references it by name. Per-type credential payloads land here as
// an encrypted JSON blob; non-secret display info goes in `metadata`
// so the list view never decrypts.

export type ConnectionType = "slack" | "google-sheets";
export const CONNECTION_TYPES: ConnectionType[] = ["slack", "google-sheets"];

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  slack: "Slack",
  "google-sheets": "Google Sheets",
};

// Per-type credential shapes. We persist whichever fields the OAuth
// callback received; field presence varies by provider. `expires_at`
// is an ISO timestamp string so it round-trips through JSON cleanly.
export type SlackCredentials = {
  access_token: string;
  scope?: string;
  bot_user_id?: string;
  team_id?: string;
};

export type GoogleSheetsCredentials = {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  expires_at?: string;
  token_type?: string;
};

export type ConnectionCredentials =
  | { type: "slack"; payload: SlackCredentials }
  | { type: "google-sheets"; payload: GoogleSheetsCredentials };

// Non-secret display data shown in the list view (team name, account
// email, etc.). Kept in a separate JSONB column so we don't decrypt
// on read.
export type SlackMetadata = {
  team_name?: string;
  authed_user_email?: string;
};

export type GoogleSheetsMetadata = {
  account_email?: string;
};

export type ConnectionMetadata = SlackMetadata | GoogleSheetsMetadata | object;

export type WorkspaceConnection = {
  id: string;
  workspaceId: string;
  type: ConnectionType;
  name: string;
  metadata: ConnectionMetadata;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type ConnectionRow = {
  id: string;
  workspace_id: string;
  type: ConnectionType;
  name: string;
  metadata: ConnectionMetadata;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

const CONNECTION_COLUMNS =
  "id, workspace_id, type, name, metadata, created_by, created_at, updated_at";

function rowToConnection(row: ConnectionRow): WorkspaceConnection {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    name: row.name,
    metadata: row.metadata ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listConnectionsForWorkspace(
  workspaceId: string,
): Promise<WorkspaceConnection[]> {
  const { rows } = await db.query<ConnectionRow>(
    `SELECT ${CONNECTION_COLUMNS}
       FROM workspace_connection
      WHERE workspace_id = $1
      ORDER BY type ASC, name ASC`,
    [workspaceId],
  );
  return rows.map(rowToConnection);
}

export async function getConnectionByName(
  workspaceId: string,
  type: ConnectionType,
  name: string,
): Promise<WorkspaceConnection | null> {
  const { rows } = await db.query<ConnectionRow>(
    `SELECT ${CONNECTION_COLUMNS}
       FROM workspace_connection
      WHERE workspace_id = $1 AND type = $2 AND name = $3
      LIMIT 1`,
    [workspaceId, type, name],
  );
  return rows[0] ? rowToConnection(rows[0]) : null;
}

/**
 * Decrypt and return the stored credential blob. Runtime use only —
 * never serialize the result to a client. Throws if the row is
 * missing or the encryption key has rotated under us.
 */
export async function getConnectionCredentials(
  connectionId: string,
): Promise<{ type: ConnectionType; payload: unknown }> {
  const { rows } = await db.query<{ type: ConnectionType; credentials: Buffer }>(
    `SELECT type, credentials FROM workspace_connection WHERE id = $1`,
    [connectionId],
  );
  if (!rows[0]) {
    throw new Error(`workspace_connection ${connectionId} not found`);
  }
  const plaintext = decryptSecret(rows[0].credentials);
  return { type: rows[0].type, payload: JSON.parse(plaintext) };
}

/**
 * Upsert a connection. On (workspace_id, type, name) conflict, replaces
 * the credentials + metadata in place — the natural "reconnect" flow
 * for re-issuing an OAuth token without orphaning the row.
 */
export async function saveConnection(args: {
  workspaceId: string;
  type: ConnectionType;
  name: string;
  credentials: SlackCredentials | GoogleSheetsCredentials;
  metadata: ConnectionMetadata;
  userId: string;
}): Promise<WorkspaceConnection> {
  const ciphertext = encryptSecret(JSON.stringify(args.credentials));
  const { rows } = await db.query<ConnectionRow>(
    `INSERT INTO workspace_connection
       (workspace_id, type, name, credentials, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (workspace_id, type, name)
       DO UPDATE SET credentials = EXCLUDED.credentials,
                     metadata    = EXCLUDED.metadata,
                     updated_at  = NOW()
       RETURNING ${CONNECTION_COLUMNS}`,
    [
      args.workspaceId,
      args.type,
      args.name,
      ciphertext,
      JSON.stringify(args.metadata),
      args.userId,
    ],
  );
  return rowToConnection(rows[0]);
}

export async function deleteConnection(
  workspaceId: string,
  connectionId: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM workspace_connection WHERE id = $1 AND workspace_id = $2`,
    [connectionId, workspaceId],
  );
  return (rowCount ?? 0) > 0;
}
