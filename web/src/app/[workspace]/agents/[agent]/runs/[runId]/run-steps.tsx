import { Badge } from "@/components/ui/badge";
import { estimateRunCost, formatCurrency, formatTokens } from "@/lib/pricing";
import type { RunStep, RunToolCall } from "@/lib/runs-db";

// Per model-step view of a run: one row per LLM request, showing the tokens it
// used and the tool calls it emitted. Token usage is per step (one API
// request), not per individual tool_use — a step can fire several tool calls
// that share the request's tokens. Output tokens are what the model generated
// that step; input tokens include the resent conversation history, so they
// climb step over step.
export function RunSteps({
  model,
  steps,
  calls,
}: {
  model: string;
  steps: RunStep[];
  calls: RunToolCall[];
}) {
  const callsByStep = new Map<number, RunToolCall[]>();
  for (const c of calls) {
    if (c.stepOrdinal === null) continue;
    const arr = callsByStep.get(c.stepOrdinal) ?? [];
    arr.push(c);
    callsByStep.set(c.stepOrdinal, arr);
  }

  return (
    <ol className="divide-border bg-surface border-border flex flex-col divide-y overflow-hidden rounded-lg border">
      {steps.map((s) => {
        const stepCalls = callsByStep.get(s.ordinal) ?? [];
        const cost =
          s.inputTokens !== null && s.outputTokens !== null
            ? estimateRunCost(model, s.inputTokens, s.outputTokens)
            : null;
        return (
          <li key={s.ordinal} className="flex flex-col gap-1.5 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-foreground text-sm font-medium">
                Step {s.ordinal + 1}
              </span>
              <span className="text-foreground-weak text-xs">
                {s.outputTokens !== null && (
                  <>
                    <span className="text-foreground font-medium">
                      {formatTokens(s.outputTokens)}
                    </span>{" "}
                    out
                  </>
                )}
                {s.inputTokens !== null && (
                  <> · {formatTokens(s.inputTokens)} in</>
                )}
                {s.cacheReadTokens !== null && s.cacheReadTokens > 0 && (
                  <> · {formatTokens(s.cacheReadTokens)} cached</>
                )}
                {cost !== null && <> · ~{formatCurrency(cost)}</>}
              </span>
            </div>
            {stepCalls.length > 0 && (
              <ul className="flex flex-col gap-1 border-l border-[var(--color-border)] pl-3">
                {stepCalls.map((c) => (
                  <li key={c.ordinal} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-foreground-weak truncate text-xs">
                        {c.toolName}
                      </code>
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
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
