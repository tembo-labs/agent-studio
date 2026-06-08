import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { estimateRunCost, formatCurrency, formatTokens } from "@/lib/pricing";
import type { RunStep, RunToolCall } from "@/lib/runs-db";

import { ToolProviderLogo } from "./tool-provider-logo";

// Resolved provider for a tool name, keyed by run_tool_call.tool_name. `slug`
// is the provider slug used for the logo (e.g. "attio"); `label` is its
// display name for the tooltip.
export type ToolProviderMap = Record<string, { slug: string; label: string }>;

// Shared column template so the header, step rows, and tool rows all line up.
// Fixed widths (not auto) keep columns aligned even though each row is its own
// grid. Columns: label · In · Out · Cost · Status.
const ROW =
  "grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_5rem_5.5rem] items-center gap-x-3";

// Per model-step view of a run, as an aligned table. Tokens are per step (one
// LLM request) — a step can fire several tool calls that share its tokens.
// Input tokens include the resent conversation history (so they climb step over
// step); output is what the model generated that step. Tool-call outcomes show
// in the Status column under each step.
export function RunSteps({
  model,
  steps,
  calls,
  toolProviders = {},
}: {
  model: string;
  steps: RunStep[];
  calls: RunToolCall[];
  toolProviders?: ToolProviderMap;
}) {
  const callsByStep = new Map<number, RunToolCall[]>();
  for (const c of calls) {
    if (c.stepOrdinal === null) continue;
    const arr = callsByStep.get(c.stepOrdinal) ?? [];
    arr.push(c);
    callsByStep.set(c.stepOrdinal, arr);
  }

  return (
    <div className="bg-surface border-border overflow-hidden rounded-lg border">
      <div
        className={`${ROW} text-foreground-muted border-border border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide`}
      >
        <span>Step</span>
        <span className="text-right">In</span>
        <span className="text-right">Out</span>
        <span className="text-right">Cost</span>
        <span className="text-right">Status</span>
      </div>

      {steps.map((s, i) => {
        const stepCalls = callsByStep.get(s.ordinal) ?? [];
        const cost =
          s.inputTokens !== null && s.outputTokens !== null
            ? estimateRunCost(model, s.inputTokens, s.outputTokens)
            : null;
        return (
          <Fragment key={s.ordinal}>
            <div
              className={`${ROW} px-3 py-2 ${i > 0 ? "border-border border-t" : ""}`}
            >
              <span className="text-foreground truncate text-sm font-medium">
                Step {s.ordinal + 1}
              </span>
              <span className="text-foreground-weak text-right text-xs tabular-nums">
                {s.inputTokens !== null ? formatTokens(s.inputTokens) : "—"}
              </span>
              <span className="text-foreground text-right text-xs font-medium tabular-nums">
                {s.outputTokens !== null ? formatTokens(s.outputTokens) : "—"}
              </span>
              <span className="text-foreground-weak text-right text-xs tabular-nums">
                {cost !== null ? `~${formatCurrency(cost)}` : "—"}
              </span>
              <span />
            </div>

            {stepCalls.map((c) => {
              const tp = toolProviders[c.toolName];
              return (
                <Fragment key={c.ordinal}>
                  <div className={`${ROW} px-3 pb-1.5`}>
                    <span className="flex min-w-0 items-center gap-1.5 pl-3">
                      {tp && (
                        <ToolProviderLogo providerSlug={tp.slug} title={tp.label} />
                      )}
                      <code className="text-foreground-weak truncate text-xs">
                        {c.toolName}
                      </code>
                    </span>
                    <span />
                    <span />
                    <span />
                    <span className="flex justify-end">
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
                    </span>
                  </div>
                  {c.ok === false && c.errorMessage && (
                    <p className="text-sentiment-negative line-clamp-2 px-3 pb-1.5 pl-[2.25rem] font-mono text-xs leading-4">
                      {c.errorMessage}
                    </p>
                  )}
                </Fragment>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
