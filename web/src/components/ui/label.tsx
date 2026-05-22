// Vendored from tembo/monorepo packages/ui/src/components/label.tsx
import type { ComponentRef, ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { Root } from "@radix-ui/react-label";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-foreground text-base font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = forwardRef<
  ComponentRef<typeof Root>,
  ComponentPropsWithoutRef<typeof Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = Root.displayName;

export { Label };
