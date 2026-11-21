import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * The one definition of all button looks (mockup `button`). Also used by the Toggle and
 * ToggleGroup items, so a pressed toggle and a pressed button look the same.
 */
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-1 rounded-sm border font-sans " +
    "text-body whitespace-nowrap text-foreground transition-colors select-none " +
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none " +
    "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        // pressed: aria-pressed (plain toggle button) or data-state=on (Radix Toggle items)
        default:
          "border-input bg-secondary hover:bg-secondary-hover aria-expanded:bg-secondary-hover " +
          "aria-pressed:border-accent-border aria-pressed:bg-accent aria-pressed:inset-shadow-pressed " +
          "data-[state=on]:border-accent-border data-[state=on]:bg-accent " +
          "data-[state=on]:inset-shadow-pressed",
        ghost: "border-transparent bg-transparent hover:bg-accent",
      },
      size: {
        default: "h-control px-2.5",
        sm: "h-5 px-1.5 text-small",
        icon: "size-control font-semibold",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a link) with the button look instead of a <button>. */
  asChild?: boolean;
}

/** Button with the mockup look; every clickable element of the app is one of these. */
function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
