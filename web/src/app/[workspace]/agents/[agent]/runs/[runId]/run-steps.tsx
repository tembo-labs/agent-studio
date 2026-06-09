import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { abbreviateTokens, estimateTokenCost, formatPenny } from "@/lib/pricing";
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

  return (
    <div className="bg-surface border-border flex flex-col overflow-hidden rounded-lg border">
      {steps.map((s, i) => {
        const stepCalls = callsByStep.get(s.ordinal) ?? [];
        return (
          <div
            key={s.ordinal}
            className={`flex flex-col gap-1.5 px-3 py-2.5 ${i > 0 ? "border-border border-t" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-foreground min-w-0 flex-1 whitespace-pre-wrap text-sm leading-6">
                {s.summary && <RevealText text={s.summary} live={live} />}
              </div>
              <TokenBox
                model={model}
                inputTokens={s.inputTokens}
                outputTokens={s.outputTokens}
              />
            </div>

            {stepCalls.map((c) => {
              const tp = toolProviders[c.toolName];
              return (
                <Fragment key={c.ordinal}>
                  <div className="flex items-center gap-1.5">
                    {tp && (
                      <ToolProviderLogo providerSlug={tp.slug} title={tp.label} />
                    )}
                    <code className="text-foreground-weak min-w-0 truncate text-xs">
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
        );
      })}
    </div>
  );
}

// A small top-right box with this step's In/Out tokens + each direction's cost.
// While a step is still in flight its tokens aren't known yet, so each line
// shows a placeholder until the step completes.
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
  return (
    <div className="border-border bg-surface-secondary text-foreground-muted shrink-0 rounded-md border px-2 py-1 text-right text-[11px] leading-4 tabular-nums">
      <div>
        {inputTokens !== null ? (
          <>
            {abbreviateTokens(inputTokens)}
            {inCost !== null && ` ~${formatPenny(inCost)}`}{" "}
            <span className="text-foreground-weak">in</span>
          </>
        ) : (
          <span>·· in</span>
        )}
      </div>
      <div>
        {outputTokens !== null ? (
          <>
            {abbreviateTokens(outputTokens)}
            {outCost !== null && ` ~${formatPenny(outCost)}`}{" "}
            <span className="text-foreground-weak">out</span>
          </>
        ) : (
          <span>·· out</span>
        )}
      </div>
    </div>
  );
}
