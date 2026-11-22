import { Pane } from "@/components/common/Pane";

/** Container 2: region input, class jump, zoom/move controls and the span in view (mockup `.navbar`). */
export function NavBar() {
  // step 8: RegionInput, ClassSelect, ViewControls, ViewSpan
  return (
    <Pane
      as="nav"
      aria-label="Navigation"
      className="col-span-full flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-2.5 py-1.5"
    >
      <span className="text-muted-foreground">Navigation bar</span>
    </Pane>
  );
}
