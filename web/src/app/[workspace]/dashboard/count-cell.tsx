"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// A count that reveals its underlying items on hover (e.g. which
// toolkits are connected, which agents have automations). Radix tooltip
// with a short delay so it pops quickly and looks consistent with the
// rest of the UI — replaces the slow, plain native `title`.
export function CountCell({
  value,
  items,
  empty,
}: {
  value: number;
  items: string[];
  empty: string;
}) {
  const hasItems = value > 0 && items.length > 0;
  const trigger = (
    <span
      className={
        hasItems
          ? "text-foreground decoration-foreground-muted cursor-default font-mono underline decoration-dotted underline-offset-4"
          : "text-foreground-muted font-mono"
      }
    >
      {value.toLocaleString("en-US")}
    </span>
  );

  return (
    <TooltipProvider delayDuration={120} skipDelayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent>
          {hasItems ? (
            <ul className="flex max-h-64 flex-col gap-0.5 overflow-auto text-left">
              {items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          ) : (
            <span className="text-foreground-weak">{empty}</span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
