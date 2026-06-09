import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import {
  abbreviateTokens,
  estimateRunCost,
  estimateTokenCost,
  formatPenny,
} from "@/lib/pricing";
import type { RunStep, RunToolCall } from "@/lib/runs-db";

import { RevealText } from "./reveal-text";
import { ToolProviderLogo } from "./tool-provider-logo";

// Resolved provider for a tool name, keyed by run_tool_call.tool_name. `slug`
// is the provider slug used for the logo (e.g. "attio"); `label` is its
// display name for the tooltip.
export type ToolProviderMap = Record<string, { slug: string; label: string }>;

// The run's step timeline. Each step shows the model's narration (or, on the
// last step, the final answer) — revealed word-by-word while live — the tool
// calls it made (status badge inline after each name), and a faint per-step
// token/cost line. Builds live as the run streams; the same view is the final
// view. Tokens are per step (one LLM request); the in/out costs are each
// direction's own.
export function RunSteps({
  model,
  steps,
  calls,
  toolProviders = {},
  live = false,
}: {
  model: string;
  steps: RunStep[];
  calls: RunToolCall[];
  toolProviders?: ToolProviderMap;
  live?: boolean;
}) {
  const callsByStep = new Map<number, RunToolCall[]>();
  for (const c of calls) {
    if (c.stepOrdinal === null) continue;
    const arr = callsByStep.get(c.stepOrdinal) ?? [];
    arr.push(c);
    callsByStep.set(c.stepOrdinal, arr);
  }

  // Run totals for the footer.
  let totalIn = 0;
  let totalOut = 0;
  let hasTokens = false;
  for (const s of steps) {
    if (s.inputTokens !== null) {
      totalIn += s.inputTokens;
      hasTokens = true;
    }
    if (s.outputTokens !== null) {
      totalOut += s.outputTokens;
      hasTokens = true;
    }
  }
  const combinedCost = estimateRunCost(model, totalIn, totalOut);

  return (
    <div className="bg-surface border-border flex flex-col overflow-hidden rounded-lg border">
      {steps.map((s, i) => {
        const stepCalls = callsByStep.get(s.ordinal) ?? [];
        return (
          <div
            key={s.ordinal}
            className={`flex items-start gap-x-4 px-3 py-2 ${i > 0 ? "border-border border-t" : ""}`}
          >
            {/* Col 1: narration + tool calls. Cols 2/3: In / Out. */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {s.summary && (
                <div className="text-foreground whitespace-pre-wrap text-base leading-6">
                  <RevealText text={s.summary} live={live} />
                </div>
              )}
              {stepCalls.map((c) => {
                const tp = toolProviders[c.toolName];
                return (
                  <Fragment key={c.ordinal}>
                    <div className="flex items-center gap-1.5">
                      {tp && (
                        <ToolProviderLogo providerSlug={tp.slug} title={tp.label} />
                      )}
                      <code className="text-foreground-weak min-w-0 truncate text-sm">
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
                          running
                        </Badge>
                      )}
                    </div>
                    {c.ok === false && c.errorMessage && (
                      <p className="text-sentiment-negative line-clamp-2 pl-[1.375rem] font-mono text-xs leading-4">
                        {c.errorMessage}
                      </p>
                    )}
                  </Fragment>
                );
              })}
            </div>
            <span className="text-foreground-muted w-28 shrink-0 whitespace-nowrap text-right text-xs leading-6 tabular-nums">
              {dirStr(model, s.inputTokens, "input")}{" "}
              <span className="text-foreground-weak">in</span>
            </span>
            <span className="text-foreground-muted w-28 shrink-0 whitespace-nowrap text-right text-xs leading-6 tabular-nums">
              {dirStr(model, s.outputTokens, "output")}{" "}
              <span className="text-foreground-weak">out</span>
            </span>
            {/* reserve the totals column so In/Out align with the footer */}
            <span className="w-28 shrink-0" aria-hidden />
          </div>
        );
      })}

      {hasTokens && (
        <div className="border-border bg-surface-secondary flex items-baseline gap-x-4 border-t px-3 py-2.5">
          <span className="min-w-0 flex-1" />
          <span className="text-foreground w-28 shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums">
            {dirStr(model, totalIn, "input")}{" "}
            <span className="text-foreground-weak font-normal">in</span>
          </span>
          <span className="text-foreground w-28 shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums">
            {dirStr(model, totalOut, "output")}{" "}
            <span className="text-foreground-weak font-normal">out</span>
          </span>
          <span className="text-foreground-weak w-28 shrink-0 whitespace-nowrap text-right text-xs tabular-nums">
            total {abbreviateTokens(totalIn + totalOut)}
            {combinedCost !== null && ` ~${formatPenny(combinedCost)}`}
          </span>
        </div>
      )}
    </div>
  );
}

// "9.50k ~$.04" for one direction's tokens + cost; "··" until tokens land.
function dirStr(
  model: string,
  tokens: number | null,
  direction: "input" | "output",
): string {
  if (tokens === null) return "··";
  const cost = estimateTokenCost(model, tokens, direction);
  return `${abbreviateTokens(tokens)}${cost !== null ? ` ~${formatPenny(cost)}` : ""}`;
}
