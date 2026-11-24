import type { ComponentProps } from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";

import { JOINED_GROUP_CLASSES } from "@/components/ui/button-group";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Segmented control (mockup `.seg`), e.g. Reads `All | MAPQ ≥ 20`. With `type="single"` Radix
 * gives the items role="radio" + aria-checked, not aria-pressed, so the pressed look keys on
 * data-state=on (see buttonVariants).
 */
function ToggleGroup({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(JOINED_GROUP_CLASSES, className)}
      {...props}
    />
  );
}

/** One segment of a ToggleGroup; the pressed segment is drawn above its neighbours. */
function ToggleGroupItem({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(buttonVariants(), "data-[state=on]:z-1", className)}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
