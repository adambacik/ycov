import type { ComponentProps } from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/** Muted key text in front of a control (mockup `.k`), e.g. "Normalisation", "Region". */
function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "inline-flex items-center gap-1.5 text-body text-muted-foreground select-none",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
