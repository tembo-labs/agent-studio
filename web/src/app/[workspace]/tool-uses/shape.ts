// JSON-safe shape for tool-call rows crossing the server-action <-> client
// boundary (Date → ISO string), mirroring runs/shape.ts.

import type { ToolCallListItem } from "@/lib/runs-db";

export type LoadedToolCall = Omit<ToolCallListItem, "createdAt"> & {
  createdAt: string;
};

export function toLoaded(t: ToolCallListItem): LoadedToolCall {
  return {
    id: t.id,
    runId: t.runId,
    agentName: t.agentName,
    toolName: t.toolName,
    ok: t.ok,
    errorMessage: t.errorMessage,
    createdAt: t.createdAt.toISOString(),
  };
}
