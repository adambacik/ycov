import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Landmark elements a pane can be; all six page areas are landmarks (mockup `.pane`). */
type PaneElement = "header" | "nav" | "section" | "aside" | "main" | "footer";

interface PaneProps extends ComponentProps<"section"> {
  /** element to render, chosen by the role of the area (default "section") */
  as?: PaneElement;
  /** required: names the landmark for screen readers ("Navigation", "Samples", …) */
  "aria-label": string;
}

/** White bordered container used by all six page areas. */
export function Pane({ as: Element = "section", className, ...props }: PaneProps) {
  return (
    <Element
      className={cn("min-w-0 rounded-sm border border-border bg-card", className)}
      {...props}
    />
  );
}
