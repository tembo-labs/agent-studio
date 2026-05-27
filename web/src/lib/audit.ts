// Audit types shared between server-only and client modules. The
// server-side DB helpers live in @/lib/audit-db (imports "server-only"
// and can't cross the client boundary). Anything a client component
// needs to know — the source enum, payload shape, source labels —
// lives here so server-only can re-export and the client can import
// without dragging Postgres into the browser bundle.

export type AuditSource =
  | "chat"
  | "pr"
  | "hitl_response"
  | "dashboard_event"
  | "correction"
  | "human_action"
  | "policy_change"
  | "system";

export const ALL_AUDIT_SOURCES: AuditSource[] = [
  "chat",
  "pr",
  "hitl_response",
  "dashboard_event",
  "correction",
  "human_action",
  "policy_change",
  "system",
];

export type AuditEntry = {
  id: string;
  /** Stable identifier of the underlying row type — "audit_event",
   *  "run", or "improvement". Used to drive click-throughs. */
  origin: "audit_event" | "run" | "improvement";
  workspaceId: string;
  actorUserId: string | null;
  /** Display name joined from the user table when available. NULL
   *  when actor is system OR when the user row was deleted. */
  actorDisplayName: string | null;
  at: Date;
  source: AuditSource;
  /** Specific event identifier, e.g. 'run.failed', 'automation.created'.
   *  The UI maps this to a human label via a lookup table. */
  kind: string;
  targetType: string;
  targetId: string | null;
  agentName: string | null;
  payload: Record<string, unknown>;
  referencesEventId: string | null;
};
