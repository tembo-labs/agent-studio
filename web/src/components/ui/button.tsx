// Vendored from tembo/monorepo packages/ui/src/components/button.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import {
  Children,
  Fragment,
  cloneElement,
  forwardRef,
  isValidElement,
} from "react";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

function wrapTextInSpans(children: ReactNode): ReactNode {
  return Children.map(children, (child, index) => {
    if (typeof child === "string" && child.trim()) {
      return <span key={index}>{child}</span>;
    }
    if (typeof child === "number") {
      return <span key={index}>{child}</span>;
    }
    if (isValidElement(child)) {
      if (child.type === Fragment) {
        return cloneElement(child as ReactElement<{ children?: ReactNode }>, {
          children: wrapTextInSpans(
            (child as ReactElement<{ children?: ReactNode }>).props.children,
          ),
        });
      }
      return child;
    }
    return child;
  });
}

export const FOCUS_STATE =
  "focus:outline-hidden focus-visible:ring-0 focus-visible:shadow-focus-ring";

const buttonVariants = cva(
  "focus-visible:shadow-focus-ring disabled:text-foreground-muted disabled:[&_svg]:text-foreground-muted relative inline-flex w-fit items-center justify-center gap-0.5 text-sm font-medium whitespace-nowrap focus:outline-hidden disabled:shadow-none [&_span:first-child]:pl-[3px] [&_span:last-child]:pr-[3px] [&_svg]:pointer-events-none [&_svg]:align-middle",
  {
    defaultVariants: { size: "big", variant: "inverted" },
    variants: {
      size: {
        big: "h-[28px] rounded-lg px-[6px] py-[4px]",
        medium: "h-[24px] rounded-lg px-[4px] py-[4px]",
        small: "h-[20px] rounded-md px-[2px] py-[4px]",
      },
      variant: {
        destructive:
          "text-foreground-inverted-title bg-interactive-destructive hover:bg-interactive-destructive-hover active:bg-interactive-destructive-pressed disabled:bg-interactive-destructive-disabled [&_svg]:text-white/80",
        ghost:
          "text-foreground bg-interactive-state hover:bg-interactive-state-hover active:bg-interactive-state-pressed data-[state=open]:bg-interactive-state-active disabled:bg-interactive-state-disabled",
        green:
          "text-foreground-inverted-title bg-sentiment-positive hover:bg-green-700 active:bg-green-800 data-[state=open]:bg-green-700 disabled:bg-interactive-disabled shadow-[0_0_0_1px_rgba(0,75,8,0.55),0_-1px_2px_0_rgba(255,255,255,0.12)_inset,0_1px_2px_0_rgba(255,255,255,0.22)_inset] [&_svg]:text-white/80",
        inverted:
          "text-foreground bg-interactive-secondary hover:bg-interactive-secondary-hover active:bg-interactive-secondary-pressed data-[state=open]:bg-interactive-secondary-active disabled:bg-interactive-secondary-disabled focus:bg-interactive-secondary-hover shadow-[0_1px_2px_0_rgba(0,0,0,0.16),0_0_0_1px_rgba(0,0,0,0.08)]",
        orange:
          "disabled:bg-interactive-destructive-disabled bg-[#EB7500] text-[#FFFFFF]/92 shadow-[0_0_0_1px_#AF4C00,0_-1px_2px_0_rgba(255,255,255,0.12)_inset,0_1px_2px_0_rgba(255,255,255,0.16)_inset] hover:bg-[#FF9933] active:bg-[#FFB366] data-[state=open]:bg-[#FF9933] [&_svg]:text-white/80",
        primary:
          "text-foreground-on-accent bg-interactive hover:bg-interactive-hover active:bg-interactive-pressed data-[state=open]:bg-interactive-active disabled:bg-interactive-disabled shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_-1px_2px_0_rgba(255,255,255,0.12)_inset,0_1px_2px_0_rgba(255,255,255,0.16)_inset] [&_svg]:text-icon-accent",
        secondary:
          "text-foreground bg-interactive-tertiary hover:bg-interactive-tertiary-hover active:bg-interactive-tertiary-pressed data-[state=open]:bg-interactive-tertiary-active disabled:bg-interactive-tertiary-disabled",
      },
    },
  },
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      children,
      onClick,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    const content =
      asChild && isValidElement(children)
        ? cloneElement(children as ReactElement<{ children?: ReactNode }>, {
            children: wrapTextInSpans(
              (children as ReactElement<{ children?: ReactNode }>).props
                .children,
            ),
          })
        : wrapTextInSpans(children);

    return (
      <Comp
        className={cn(buttonVariants({ size, variant }), className)}
        ref={ref}
        {...props}
        type={type}
        onClick={onClick}
      >
        {content}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
