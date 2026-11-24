import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Joined look of a row of controls (mockup `.seg`): neighbours overlap by 1 px so that only one
 * border shows between them, and only the outer corners stay rounded. Each child keeps its full
 * border, so a pressed or focused child can be lifted above its neighbours with `z-*`.
 * Shared with ToggleGroup. Children must be the controls themselves, not wrappers around them.
 */
const JOINED_GROUP_CLASSES =
  "inline-flex w-fit items-stretch *:not-first:-ml-px *:not-first:rounded-l-none " +
  "*:not-last:rounded-r-none *:focus-visible:z-10";

/** Row of joined buttons, e.g. zoom −/+ and move ←/→. */
function ButtonGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="button-group"
      className={cn(JOINED_GROUP_CLASSES, className)}
      {...props}
    />
  );
}

export { ButtonGroup, JOINED_GROUP_CLASSES };
