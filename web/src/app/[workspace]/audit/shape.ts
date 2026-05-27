import type { AuditEntry } from "@/lib/audit";

// JSON-safe shape for AuditEntry crossing the server-action <-> client
// boundary. Mirrors the pattern in /runs/shape.ts.

export type LoadedAuditEntry = Omit<AuditEntry, "at"> & {
  at: string;
};

export function toLoadedAudit(e: AuditEntry): LoadedAuditEntry {
  return {
    ...e,
    at: e.at.toISOString(),
  };
}
