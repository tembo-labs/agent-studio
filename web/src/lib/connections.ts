import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { type McpProviderSlug } from "@/lib/mcp-providers";

// Workspace connections — the "Native MCP" half of TAS's connection
// substrate. Composio-backed connections live in
// workspace_composio_connection (lib/composio-connections.ts) and
// follow a separate path. This file owns the TAS-managed OAuth
// rows: tokens we got directly from the provider, MCP URL the
// agent runtime talks to, plus a cached tool list for the UI.
//
// Row identity is (workspace_id, user_id, type, name) — same
// per-user scoping the Composio table uses, so a workspace member
// can hold a "work" Attio and a "personal" Attio without collision,
// and audit/owner semantics align across the two connection modes.

export type NativeConnectionStatus = "active" | "stale" | "expired" | "revoked";

/**
 * Plaintext shape of the encrypted credential blob. Field set varies
 * slightly per provider but the OAuth 2.0 common ground is enough
 * for v0.4. PAT-based providers (when we add GitHub etc.) just
 * leave the refresh fields null.
 */
export type ConnectionCredentials = {
  access_token: string;
  refresh_token?: string;
  expires_at?: string; // ISO timestamp
  scope?: string;
  token_type?: string;
};

export type CachedTool = {
  /** Composio-style slug, UPPER_SNAKE_CASE if the MCP follows that
   *  convention. Provider-determined. */
  slug: string;
  name?: string;
  description?: string;
};

export type WorkspaceConnection = {
  id: string;
  workspaceId: string;
  userId: string;
  type: McpProviderSlug;
  name: string;
  mcpServerUrl: string;
  authType: "oauth2" | "pat";
  status: NativeConnectionStatus;
  tokenExpiresAt: Date | null;
  metadata: Record<string, unknown>;
  cachedTools: CachedTool[] | null;
  cachedToolsRefreshedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type ConnectionRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  type: string;
  name: string;
  mcp_server_url: string | null;
  auth_type: string | null;
  status: string;
  token_expires_at: Date | null;
  metadata: Record<string, unknown> | null;
  cached_tools: CachedTool[] | null;
  cached_tools_refreshed_at: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS = `id, workspace_id, user_id, type, name, mcp_server_url,
  auth_type, status, token_expires_at, metadata, cached_tools,
  cached_tools_refreshed_at, created_by, created_at, updated_at`;

function rowToConnection(r: ConnectionRow): WorkspaceConnection {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
    type: r.type as McpProviderSlug,
    name: r.name,
    mcpServerUrl: r.mcp_server_url ?? "",
    authType: (r.auth_type as "oauth2" | "pat") ?? "oauth2",
    status: (r.status as NativeConnectionStatus) ?? "active",
    tokenExpiresAt: r.token_expires_at,
    metadata: r.metadata ?? {},
    cachedTools: r.cached_tools,
    cachedToolsRefreshedAt: r.cached_tools_refreshed_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * List the native-MCP connections a specific user holds in a
 * workspace. The Connections page UI merges this with the Composio
 * list to produce a unified row model.
 */
export async function listNativeConnectionsForUser(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceConnection[]> {
  const { rows } = await db.query<ConnectionRow>(
    `SELECT ${COLUMNS}
       FROM workspace_connection
      WHERE workspace_id = $1 AND user_id = $2
      ORDER BY type ASC, name ASC`,
    [workspaceId, userId],
  );
  return rows.map(rowToConnection);
}

export async function getNativeConnection(
  workspaceId: string,
  userId: string,
  type: McpProviderSlug,
  name: string,
): Promise<WorkspaceConnection | null> {
  const { rows } = await db.query<ConnectionRow>(
    `SELECT ${COLUMNS}
       FROM workspace_connection
      WHERE workspace_id = $1 AND user_id = $2 AND type = $3 AND name = $4
      LIMIT 1`,
    [workspaceId, userId, type, name],
  );
  return rows[0] ? rowToConnection(rows[0]) : null;
}

export async function getNativeConnectionById(
  workspaceId: string,
  id: string,
): Promise<WorkspaceConnection | null> {
  const { rows } = await db.query<ConnectionRow>(
    `SELECT ${COLUMNS}
       FROM workspace_connection
      WHERE workspace_id = $1 AND id = $2
      LIMIT 1`,
    [workspaceId, id],
  );
  return rows[0] ? rowToConnection(rows[0]) : null;
}

/**
 * Decrypt and return the stored OAuth tokens. Runtime use only.
 * Throws when the row is missing — never returns null so the
 * runtime can't accidentally proceed without credentials.
 */
export async function getNativeConnectionCredentials(
  connectionId: string,
): Promise<ConnectionCredentials> {
  const { rows } = await db.query<{ credentials: Buffer }>(
    `SELECT credentials FROM workspace_connection WHERE id = $1`,
    [connectionId],
  );
  if (!rows[0]) {
    throw new Error(`workspace_connection ${connectionId} not found`);
  }
  return JSON.parse(decryptSecret(rows[0].credentials));
}

export type SaveNativeConnectionArgs = {
  workspaceId: string;
  userId: string;
  type: McpProviderSlug;
  name: string;
  mcpServerUrl: string;
  authType: "oauth2" | "pat";
  credentials: ConnectionCredentials;
  metadata: Record<string, unknown>;
};

/**
 * Upsert. On (workspace_id, user_id, type, name) conflict, replaces
 * the credentials + URL/auth + metadata. Stamps token_expires_at
 * from the credentials so the runner's "refresh-before-use" check
 * doesn't have to decrypt to know.
 */
export async function saveNativeConnection(
  args: SaveNativeConnectionArgs,
): Promise<WorkspaceConnection> {
  const ciphertext = encryptSecret(JSON.stringify(args.credentials));
  const expiresAt = args.credentials.expires_at
    ? new Date(args.credentials.expires_at)
    : null;

  const { rows } = await db.query<ConnectionRow>(
    `INSERT INTO workspace_connection
       (workspace_id, user_id, type, name, credentials, mcp_server_url,
        auth_type, token_expires_at, status, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $2)
       ON CONFLICT (workspace_id, user_id, type, name)
       DO UPDATE SET credentials       = EXCLUDED.credentials,
                     mcp_server_url    = EXCLUDED.mcp_server_url,
                     auth_type         = EXCLUDED.auth_type,
                     token_expires_at  = EXCLUDED.token_expires_at,
                     status            = 'active',
                     metadata          = EXCLUDED.metadata,
                     updated_at        = NOW()
       RETURNING ${COLUMNS}`,
    [
      args.workspaceId,
      args.userId,
      args.type,
      args.name,
      ciphertext,
      args.mcpServerUrl,
      args.authType,
      expiresAt,
      JSON.stringify(args.metadata),
    ],
  );
  return rowToConnection(rows[0]);
}

export async function deleteNativeConnection(
  workspaceId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM workspace_connection WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Flip a row's status (e.g., to 'stale' when the runner detects a
 * rejected token at run time). Symmetric to the Composio
 * mark-stale path in the Rust runner.
 */
export async function setNativeConnectionStatus(
  connectionId: string,
  status: NativeConnectionStatus,
): Promise<void> {
  await db.query(
    `UPDATE workspace_connection
        SET status = $2, updated_at = NOW()
      WHERE id = $1`,
    [connectionId, status],
  );
}

/**
 * Persist a freshly-fetched list_tools snapshot. The UI's
 * "available tools" hint reads this without contacting the MCP
 * server every render. Caller decides the freshness budget.
 */
export async function updateCachedTools(
  connectionId: string,
  tools: CachedTool[],
): Promise<void> {
  await db.query(
    `UPDATE workspace_connection
        SET cached_tools = $2,
            cached_tools_refreshed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [connectionId, JSON.stringify(tools)],
  );
}
