import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StatusMessageProps {
  /** "error" = red text, announced at once by screen readers */
  tone?: "info" | "error";
  className?: string;
  children: ReactNode;
}

/** One-line status in place of content: "Loading project…", load errors, empty lists. */
export function StatusMessage({ tone = "info", className, children }: StatusMessageProps) {
  return (
    <p
      // status: read out when convenient; alert: read out immediately
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "p-4 text-body",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
