import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import {
  abbreviateTokens,
  estimateInputCost,
  estimateRunCost,
  estimateTokenCost,
  formatPenny,
} from "@/lib/pricing";
import type { RunStep, RunToolCall } from "@/lib/runs-db";

import { ExpandableError } from "./expandable-error";
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

  // Run totals for the footer. Track the cache halves separately from uncached
  // input: the "in" token count shows the full context processed (input + cache
  // read + write), but the cost weights the cache portions (read 0.1x, write
  // 1.25x).
  let totalInUncached = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let totalOut = 0;
  let hasTokens = false;
  for (const s of steps) {
    if (s.inputTokens !== null) {
      totalInUncached += s.inputTokens;
      hasTokens = true;
    }
    if (s.cacheReadTokens !== null) totalCacheRead += s.cacheReadTokens;
    if (s.cacheWriteTokens !== null) totalCacheWrite += s.cacheWriteTokens;
    if (s.outputTokens !== null) {
      totalOut += s.outputTokens;
      hasTokens = true;
    }
  }
  const totalInTokens = totalInUncached + totalCacheRead + totalCacheWrite;
  const combinedCost = estimateRunCost(
    model,
    totalInUncached,
    totalOut,
    totalCacheRead,
    totalCacheWrite,
  );

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
                      <ExpandableError text={c.errorMessage} />
                    )}
                  </Fragment>
                );
              })}
            </div>
            <span className="text-foreground-muted w-28 shrink-0 whitespace-nowrap text-right text-xs leading-6 tabular-nums">
              {inStr(model, s.inputTokens, s.cacheReadTokens, s.cacheWriteTokens)}{" "}
              <span className="text-foreground-weak">in</span>
            </span>
            <span className="text-foreground-muted w-28 shrink-0 whitespace-nowrap text-right text-xs leading-6 tabular-nums">
              {dirStr(model, s.outputTokens, "output")}{" "}
              <span className="text-foreground-weak">out</span>
            </span>
          </div>
        );
      })}

      {hasTokens && (
        <div className="border-border bg-surface-secondary flex flex-col items-end gap-0.5 border-t px-3 py-2.5">
          {/* Broken-down In/Out totals — small, columns aligned with the rows. */}
          <div className="flex items-baseline gap-x-4">
            <span className="text-foreground-weak w-28 shrink-0 whitespace-nowrap text-right text-xs tabular-nums">
              {inStr(model, totalInUncached, totalCacheRead, totalCacheWrite)}{" "}
              <span className="text-foreground-muted">in</span>
            </span>
            <span className="text-foreground-weak w-28 shrink-0 whitespace-nowrap text-right text-xs tabular-nums">
              {dirStr(model, totalOut, "output")}{" "}
              <span className="text-foreground-muted">out</span>
            </span>
          </div>
          {/* Prompt-cache breakdown — shows caching is working and by how much.
              `read` tokens billed at ~0.1x, `write` (one-time) at ~1.25x; the
              `in` cost above already reflects those rates. */}
          {(totalCacheRead > 0 || totalCacheWrite > 0) && (
            <div className="text-foreground-muted whitespace-nowrap text-xs tabular-nums">
              prompt cache: {abbreviateTokens(totalCacheRead)} read
              {totalCacheWrite > 0
                ? ` · ${abbreviateTokens(totalCacheWrite)} write`
                : ""}
            </div>
          )}
          {/* Combined total — the headline number, larger. */}
          <div className="text-foreground whitespace-nowrap text-base font-semibold tabular-nums">
            {abbreviateTokens(totalInTokens + totalOut)}
            {combinedCost !== null && ` ~${formatPenny(combinedCost)}`} total
          </div>
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

// Cache-aware "in" cell. Tokens shown = the full context processed (uncached
// input + cache read + write); the cost weights the cache halves (read 0.1x,
// write 1.25x). "··" until tokens land.
function inStr(
  model: string,
  inputTokens: number | null,
  cacheReadTokens: number | null,
  cacheWriteTokens: number | null,
): string {
  if (inputTokens === null) return "··";
  const cacheRead = cacheReadTokens ?? 0;
  const cacheWrite = cacheWriteTokens ?? 0;
  const tokens = inputTokens + cacheRead + cacheWrite;
  const cost = estimateInputCost(model, inputTokens, cacheRead, cacheWrite);
  return `${abbreviateTokens(tokens)}${cost !== null ? ` ~${formatPenny(cost)}` : ""}`;
}
