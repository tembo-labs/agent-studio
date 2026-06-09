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
  const totalInCost = estimateTokenCost(model, totalIn, "input");
  const totalOutCost = estimateTokenCost(model, totalOut, "output");
  const combinedCost = estimateRunCost(model, totalIn, totalOut);

  return (
    <div className="bg-surface border-border flex flex-col overflow-hidden rounded-lg border">
      {steps.map((s, i) => {
        const stepCalls = callsByStep.get(s.ordinal) ?? [];
        return (
          <div
            key={s.ordinal}
            className={`flex items-start justify-between gap-4 px-3 py-2 ${i > 0 ? "border-border border-t" : ""}`}
          >
            {/* Col 1: narration + the tool calls. Col 2: In/Out. */}
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
            <TokenBox
              model={model}
              inputTokens={s.inputTokens}
              outputTokens={s.outputTokens}
            />
          </div>
        );
      })}

      {hasTokens && (
        <div className="border-border bg-surface-secondary flex flex-col items-end gap-0.5 border-t px-3 py-2.5">
          <div className="text-foreground text-sm font-semibold tabular-nums">
            {abbreviateTokens(totalIn)} in
            {totalInCost !== null && ` ~${formatPenny(totalInCost)}`} ·{" "}
            {abbreviateTokens(totalOut)} out
            {totalOutCost !== null && ` ~${formatPenny(totalOutCost)}`}
          </div>
          <div className="text-foreground-weak text-xs tabular-nums">
            total {abbreviateTokens(totalIn + totalOut)}
            {combinedCost !== null && ` ~${formatPenny(combinedCost)}`}
          </div>
        </div>
      )}
    </div>
  );
}

// This step's In/Out tokens + each direction's cost, on one line, pinned tight
// to the step's top-right (no box chrome). Shows a placeholder per direction
// until the step's tokens land.
function TokenBox({
  model,
  inputTokens,
  outputTokens,
}: {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}) {
  const inCost =
    inputTokens !== null ? estimateTokenCost(model, inputTokens, "input") : null;
  const outCost =
    outputTokens !== null
      ? estimateTokenCost(model, outputTokens, "output")
      : null;
  const inStr =
    inputTokens !== null
      ? `${abbreviateTokens(inputTokens)}${inCost !== null ? ` ~${formatPenny(inCost)}` : ""}`
      : "··";
  const outStr =
    outputTokens !== null
      ? `${abbreviateTokens(outputTokens)}${outCost !== null ? ` ~${formatPenny(outCost)}` : ""}`
      : "··";
  return (
    <div className="text-foreground-muted shrink-0 whitespace-nowrap text-right text-xs leading-6 tabular-nums">
      {inStr} <span className="text-foreground-weak">in</span> ·{" "}
      {outStr} <span className="text-foreground-weak">out</span>
    </div>
  );
}
