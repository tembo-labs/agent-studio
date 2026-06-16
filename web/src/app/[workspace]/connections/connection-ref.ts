import "server-only";

import {
  getComposioConnectionById,
  listConnectionsForUser,
  type WorkspaceComposioConnection,
} from "@/lib/composio-connections";
import {
  getNativeConnectionById,
  listNativeConnectionsForUser,
  type WorkspaceConnection,
} from "@/lib/connections";
import { toolkitLabel } from "@/lib/composio-label";
import { getMcpProvider } from "@/lib/mcp-providers";
import {
  listSecretConnections,
  type SecretConnectionPreview,
} from "@/lib/secret-connections";

// One Connections list/view/edit surface spans three record types. We address
// them through a single composite ref encoded into the [id] route segment:
//   composio~<uuid> | native~<uuid> | secret~<slug>
// The separator is "~" (RFC 3986 unreserved — never percent-encoded, never
// special in a path). A ":" reads as a scheme/port to some routers and proxies
// and broke the [id] route; "~" appears in neither uuids, kinds, nor secret
// slugs ([a-z0-9_-]), so splitting on the first one is unambiguous.

export type ConnectionKind = "composio" | "native" | "secret";

export type ConnectionRef = { kind: ConnectionKind; key: string };

export function encodeConnectionRef(kind: ConnectionKind, key: string): string {
  return `${kind}~${key}`;
}

export function parseConnectionRef(raw: string): ConnectionRef | null {
  const i = raw.indexOf("~");
  if (i <= 0) return null;
  const kind = raw.slice(0, i);
  const key = raw.slice(i + 1);
  if (!key) return null;
  if (kind === "composio" || kind === "native" || kind === "secret") {
    return { kind, key };
  }
  return null;
}

export type StatusVariant = "green" | "gray" | "yellow" | "red";

export type ConnectionRow = {
  ref: string;
  kind: ConnectionKind;
  /** Provider/toolkit display name, or the secret slug. */
  title: string;
  /** Connection slot name for OAuth rows (shown as "· name"); null for secrets. */
  slot: string | null;
  typeLabel: string;
  /** Provider/toolkit slug for <McpProviderLogo>; null for secrets. */
  logoSlug: string | null;
  statusLabel: string;
  statusVariant: StatusVariant;
};

function nativeStatusVariant(status: WorkspaceConnection["status"]): StatusVariant {
  switch (status) {
    case "active":
      return "green";
    case "stale":
    case "expired":
      return "yellow";
    case "revoked":
      return "red";
    default:
      return "gray";
  }
}

function composioStatusVariant(status: string): StatusVariant {
  return status.toLowerCase() === "active" ? "green" : "yellow";
}

function nativeTitle(conn: WorkspaceConnection): string {
  return getMcpProvider(conn.type)?.displayName ?? conn.type;
}

/**
 * The whole list, merged across substrates: the view-user's OAuth connections
 * (native + Composio) plus the workspace's secrets. Sorted within each group by
 * display name; groups concatenated native → composio → secret.
 */
export async function listAllConnections(
  workspaceId: string,
  viewUserId: string,
): Promise<ConnectionRow[]> {
  const [native, composio, secrets] = await Promise.all([
    listNativeConnectionsForUser(workspaceId, viewUserId),
    listConnectionsForUser(workspaceId, viewUserId),
    listSecretConnections(workspaceId),
  ]);

  const nativeRows: ConnectionRow[] = native
    .map((c) => ({
      ref: encodeConnectionRef("native", c.id),
      kind: "native" as const,
      title: nativeTitle(c),
      slot: c.name,
      typeLabel: "MCP · OAuth",
      logoSlug: c.type,
      statusLabel: c.status,
      statusVariant: nativeStatusVariant(c.status),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const composioRows: ConnectionRow[] = composio
    .map((c) => ({
      ref: encodeConnectionRef("composio", c.id),
      kind: "composio" as const,
      title: toolkitLabel(c.toolkit),
      slot: c.name,
      typeLabel: "Composio",
      logoSlug: c.toolkit,
      statusLabel: c.status.toLowerCase(),
      statusVariant: composioStatusVariant(c.status),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const secretRows: ConnectionRow[] = secrets
    .map((s) => ({
      ref: encodeConnectionRef("secret", s.slug),
      kind: "secret" as const,
      title: s.slug,
      slot: null,
      typeLabel: "Secret",
      logoSlug: null,
      statusLabel: "set",
      statusVariant: "green" as const,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return [...nativeRows, ...composioRows, ...secretRows];
}

export type LoadedConnection =
  | { kind: "native"; conn: WorkspaceConnection }
  | { kind: "composio"; conn: WorkspaceComposioConnection }
  | { kind: "secret"; secret: SecretConnectionPreview };

/**
 * Resolve a ref to its record, scoped to the view-user (the acting user, or the
 * member an admin is viewing — both flow in as viewUserId). Returns null when
 * the record is missing or belongs to someone else, so callers can notFound().
 */
export async function loadConnection(
  workspaceId: string,
  viewUserId: string,
  ref: ConnectionRef,
): Promise<LoadedConnection | null> {
  if (ref.kind === "native") {
    const conn = await getNativeConnectionById(workspaceId, ref.key);
    if (!conn || conn.userId !== viewUserId) return null;
    return { kind: "native", conn };
  }
  if (ref.kind === "composio") {
    const conn = await getComposioConnectionById(workspaceId, ref.key);
    if (!conn || conn.userId !== viewUserId) return null;
    return { kind: "composio", conn };
  }
  const secret = (await listSecretConnections(workspaceId)).find(
    (s) => s.slug === ref.key,
  );
  return secret ? { kind: "secret", secret } : null;
}
