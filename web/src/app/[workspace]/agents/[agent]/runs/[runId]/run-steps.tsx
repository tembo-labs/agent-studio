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
            {s.summary && (
              <div className="text-foreground whitespace-pre-wrap text-sm leading-6">
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

            <TokenMeta
              model={model}
              inputTokens={s.inputTokens}
              outputTokens={s.outputTokens}
            />
          </div>
        );
      })}
    </div>
  );
}

// Faint per-step "9.50k in ~$.04 · 1.30k out ~$.05" line. While a step is still
// in flight its tokens aren't known yet, so it shows a placeholder.
function TokenMeta({
  model,
  inputTokens,
  outputTokens,
}: {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}) {
  if (inputTokens === null && outputTokens === null) {
    return <span className="text-foreground-muted text-xs">·····</span>;
  }
  const parts: string[] = [];
  if (inputTokens !== null) {
    const c = estimateTokenCost(model, inputTokens, "input");
    parts.push(
      `${abbreviateTokens(inputTokens)} in${c !== null ? ` ~${formatPenny(c)}` : ""}`,
    );
  }
  if (outputTokens !== null) {
    const c = estimateTokenCost(model, outputTokens, "output");
    parts.push(
      `${abbreviateTokens(outputTokens)} out${c !== null ? ` ~${formatPenny(c)}` : ""}`,
    );
  }
  return (
    <span className="text-foreground-muted text-xs tabular-nums">
      {parts.join(" · ")}
    </span>
  );
}
