import { Badge } from "@/components/ui/badge";
import type { RunToolCall } from "@/lib/runs-db";

// The tools the agent called during a run, in call order. Each row shows
// the tool name + outcome: ok (returned), failed (errored — with the
// truncated error), or "no result" (the run ended before it returned).
export function ToolsUsed({ calls }: { calls: RunToolCall[] }) {
  return (
    <ol className="divide-border bg-surface border-border flex flex-col divide-y overflow-hidden rounded-lg border">
      {calls.map((c) => (
        <li
          key={c.ordinal}
          className="flex flex-col gap-1 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-3">
            <code className="text-foreground truncate text-sm">{c.toolName}</code>
            {c.ok === true ? (
              <Badge variant="green" size="small">
                ok
              </Badge>
            ) : c.ok === false ? (
              <Badge variant="red" size="small">
                failed
              </Badge>
            ) : (
              <Badge variant="gray" size="small">
                no result
              </Badge>
            )}
          </div>
          {c.ok === false && c.errorMessage && (
            <p className="text-sentiment-negative line-clamp-2 font-mono text-xs leading-4">
              {c.errorMessage}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
