import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Text input (mockup `input[type=text]`): white, mono font for coordinates. aria-invalid draws
 * the red error border (mockup `input.bad`). Disabled keeps the text readable, because the
 * Phase 2 region input is disabled but still shows the current region.
 */
function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-control w-full min-w-0 rounded-sm border border-input bg-card px-1.5 font-mono text-body " +
          "text-foreground placeholder:font-sans placeholder:text-muted-foreground " +
          "disabled:pointer-events-none disabled:bg-muted " +
          "aria-invalid:border-destructive aria-invalid:outline-1 aria-invalid:outline-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
