import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface LabeledValueProps {
  /** muted key in front of the value, e.g. "Project" */
  label: string;
  children: ReactNode;
  /** native tooltip on the whole pair, e.g. where a value comes from */
  title?: string;
  className?: string;
}

/** Read-only key + value pair, "Project demo_cohort" (mockup `.k` + text). */
export function LabeledValue({ label, children, title, className }: LabeledValueProps) {
  return (
    <span title={title} className={cn("inline-flex items-baseline gap-1", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </span>
  );
}
