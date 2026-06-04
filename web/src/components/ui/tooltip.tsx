// Slim Tooltip wrapper — Radix primitives styled with Tembo tokens.
// Mirrors the alert-dialog.tsx convention. Fast popup by default
// (callers pass a short delayDuration on the Provider).
"use client";

import {
  Provider,
  Root,
  Trigger,
  Portal,
  Content,
} from "@radix-ui/react-tooltip";
import type { ComponentRef, ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const TooltipProvider = Provider;
const Tooltip = Root;
const TooltipTrigger = Trigger;

const TooltipContent = forwardRef<
  ComponentRef<typeof Content>,
  ComponentPropsWithoutRef<typeof Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <Portal>
    <Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "bg-surface-raised border-border text-foreground z-50 max-w-xs rounded-lg border px-2.5 py-1.5 text-sm shadow-[0_8px_24px_0_rgba(0,0,0,0.12)]",
        "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
        "data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className,
      )}
      {...props}
    />
  </Portal>
));
TooltipContent.displayName = Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
