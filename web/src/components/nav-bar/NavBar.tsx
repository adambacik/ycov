import { Pane } from "@/components/common/Pane";
import { ClassSelect } from "@/components/nav-bar/ClassSelect";
import { RegionInput } from "@/components/nav-bar/RegionInput";
import { ViewControls } from "@/components/nav-bar/ViewControls";
import { ViewSpan } from "@/components/nav-bar/ViewSpan";

/**
 * Container 2 (mockup `.navbar`): region input, class jump, zoom/move/reset and the span in
 * view. Wraps when narrow; below 980 px the region form takes a line of its own.
 */
export function NavBar() {
  return (
    <Pane
      as="nav"
      aria-label="Navigation"
      className="col-span-full flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-2.5 py-1.5"
    >
      <RegionInput />
      <ClassSelect />
      <ViewControls />
      <ViewSpan />
    </Pane>
  );
}
