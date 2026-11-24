import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface LaterVersionHintProps {
  /** the disabled control, optionally with its key text */
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper around a control that is shown but not working yet: tooltip "Available in a later
 * version". The title sits on this wrapper because disabled controls get no pointer events.
 */
export function LaterVersionHint({ children, className }: LaterVersionHintProps) {
  return (
    <span
      title="Available in a later version"
      className={cn("inline-flex cursor-not-allowed items-center gap-1.5", className)}
    >
      {children}
    </span>
  );
}
